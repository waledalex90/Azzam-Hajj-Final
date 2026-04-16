import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type AttendanceStatus = "present" | "absent" | "half";

type SubmitPayload = {
  items: Array<{ worker_id: number; status: AttendanceStatus }>;
  workDate: string;
  note: string;
  /** 1 = صباحي، 2 = مسائي — يُمرَّر لـ RPC كـ p_round_no */
  roundNo?: number;
  idempotencyKey?: string | null;
};

type ApprovalDecisionPayload = {
  checkIds: number[];
  decision: "confirm" | "reject";
  idempotencyKey?: string | null;
};

type IdempotencyScope = "attendance_sync" | "approval_sync";
/** يجب أن تكون `public.submit_attendance_bulk_checks(date,jsonb,text,int)` منشأة — انظر `supabase_shift_round_rpc.sql`. */
const BULK_ATTENDANCE_PUBLIC_RPC = "submit_attendance_bulk_checks";
/** `public.approve_attendance_checks_batch(bigint[],boolean)` — انظر `supabase_approve_checks_batch_rpc.sql`. */
const APPROVAL_BATCH_RPC = "approve_attendance_checks_batch";

async function hasProcessedIdempotencyKey(idempotencyKey: string) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("sync_idempotency_keys")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle<{ id: number }>();

  // If table does not exist yet, do not block processing.
  if (error && (error as { code?: string }).code === "42P01") {
    return false;
  }
  return Boolean(data?.id);
}

async function markIdempotencyKeyProcessed(idempotencyKey: string) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("sync_idempotency_keys").insert({
    idempotency_key: idempotencyKey,
    action_scope: "attendance_sync",
  });

  // Ignore if duplicate or table absent.
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505" || code === "42P01") return;
  }
}

export async function submitAttendanceByWorkersEngine({
  items,
  workDate,
  note,
  roundNo: roundNoRaw,
  idempotencyKey,
}: SubmitPayload) {
  if (items.length === 0) return;
  if (isDemoModeEnabled()) return;
  if (idempotencyKey && (await hasProcessedIdempotencyKey(idempotencyKey))) return;

  const supabase = createSupabaseAdminClient();
  const payload = items
    .map((item) => ({
      worker_id: Number(item.worker_id),
      status: item.status,
    }))
    .filter((item) => Number.isFinite(item.worker_id) && item.worker_id > 0);
  if (payload.length === 0) return;

  const roundNo = Math.max(1, Math.min(Number(roundNoRaw) || 1, 9));

  const rpcClient = await createSupabaseServerClient();
  const { error } = await rpcClient.rpc(BULK_ATTENDANCE_PUBLIC_RPC, {
    p_work_date: workDate,
    p_payload: payload,
    p_notes: note,
    p_round_no: roundNo,
  });
  if (error) {
    throw new Error(error.message || "submit_attendance_bulk_checks_failed");
  }

  if (idempotencyKey) {
    await markIdempotencyKeyProcessed(idempotencyKey);
  }
}

async function markIdempotencyKeyProcessedForScope(idempotencyKey: string, scope: IdempotencyScope) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("sync_idempotency_keys").insert({
    idempotency_key: idempotencyKey,
    action_scope: scope,
  });

  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "23505" || code === "42P01") return;
  }
}

async function applyApprovalDecisionsViaDirectUpdate(
  uniqueIds: number[],
  decision: "confirm" | "reject",
) {
  const supabase = createSupabaseAdminClient();
  const nextStatus = decision === "confirm" ? "confirmed" : "rejected";
  const { data, error } = await supabase
    .from("attendance_checks")
    .update({
      confirmation_status: nextStatus,
      confirmed_at: new Date().toISOString(),
      is_approved: decision === "confirm",
    })
    .in("id", uniqueIds)
    .select("id");

  if (error) {
    throw new Error(error.message || "attendance_checks_update_failed");
  }
  const got = data?.length ?? 0;
  if (got !== uniqueIds.length) {
    throw new Error(`attendance_checks_update_mismatch:expected_${uniqueIds.length}_got_${got}`);
  }
}

export async function applyApprovalDecisionsEngine({
  checkIds,
  decision,
  idempotencyKey,
}: ApprovalDecisionPayload) {
  const uniqueIds = Array.from(new Set(checkIds.map((id) => Number(id)).filter(Boolean)));
  if (uniqueIds.length === 0) return;
  if (isDemoModeEnabled()) return;
  if (idempotencyKey && (await hasProcessedIdempotencyKey(idempotencyKey))) return;

  const supabase = createSupabaseAdminClient();
  const { data: rpcRows, error: rpcError } = await supabase.rpc(APPROVAL_BATCH_RPC, {
    p_check_ids: uniqueIds,
    p_confirm: decision === "confirm",
  });

  const n = typeof rpcRows === "number" ? rpcRows : Number(rpcRows);
  const rpcOk = !rpcError && Number.isFinite(n) && n === uniqueIds.length;
  if (!rpcOk) {
    await applyApprovalDecisionsViaDirectUpdate(uniqueIds, decision);
  }

  if (idempotencyKey) {
    await markIdempotencyKeyProcessedForScope(idempotencyKey, "approval_sync");
  }
}

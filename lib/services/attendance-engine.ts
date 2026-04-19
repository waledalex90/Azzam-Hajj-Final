import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { formatPostgrestLikeError } from "@/lib/utils/postgrest-error";

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

function parseBulkAttendanceRpcRows(data: unknown): { inserted: number; updated: number } {
  if (data == null) return { inserted: 0, updated: 0 };
  const rows = Array.isArray(data) ? data : [data];
  let inserted = 0;
  let updated = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const i = Number(o.inserted_count ?? 0);
    const u = Number(o.updated_count ?? 0);
    if (Number.isFinite(i)) inserted += i;
    if (Number.isFinite(u)) updated += u;
  }
  return { inserted, updated };
}

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

  const lastByWorker = new Map<number, { worker_id: number; status: AttendanceStatus }>();
  for (const item of items) {
    const worker_id = Number(item.worker_id);
    if (!Number.isFinite(worker_id) || worker_id <= 0) continue;
    lastByWorker.set(worker_id, { worker_id, status: item.status });
  }
  const payload = Array.from(lastByWorker.values());
  if (payload.length === 0) return;

  const roundNo = Math.max(1, Math.min(Number(roundNoRaw) || 1, 9));

  const rpcClient = await createSupabaseServerClient();
  const { data, error } = await rpcClient.rpc(BULK_ATTENDANCE_PUBLIC_RPC, {
    p_work_date: workDate,
    p_payload: payload,
    p_notes: note,
    p_round_no: roundNo,
  });
  if (error) {
    throw new Error(formatPostgrestLikeError(error));
  }

  const { inserted, updated } = parseBulkAttendanceRpcRows(data);
  const touched = inserted + updated;
  if (touched === 0 && payload.length > 0) {
    throw new Error(
      "لم يُحفظ أي سجل في الحضور. إن كان الموقع وصلاحيات حسابك صحيحة: اطلب من مسؤول قاعدة البيانات تشغيل سكربت supabase_fix_can_access_match_app_user_sites.sql (يصلح قراءة المواقع من app_user_sites وصلاحية المراقب الفني). يمكن أيضاً تجربة تسجيل الخروج والدخول.",
    );
  }
  if (touched < payload.length) {
    throw new Error(
      `حُفظ ${touched} من ${payload.length} عاملًا مميّزًا فقط. الباقي لا يمرّ فلتر قاعدة البيانات (موقع العامل فارغ، أو غير ضمن مواقعك بعد دمج allowed_site_ids و app_user_sites، أو عامل موقوف/محذوف). حدّث الصفحة وتحقق من شاشة «العمال».`,
    );
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
    })
    .eq("confirmation_status", "pending")
    .in("id", uniqueIds)
    .select("id");

  if (error) {
    throw new Error(formatPostgrestLikeError(error));
  }

  const got = data?.length ?? 0;
  if (got > 0) return;

  const { data: rows, error: selErr } = await supabase
    .from("attendance_checks")
    .select("id, confirmation_status")
    .in("id", uniqueIds);
  if (selErr) {
    throw new Error(formatPostgrestLikeError(selErr));
  }
  if (!rows || rows.length !== uniqueIds.length) {
    throw new Error("attendance_checks_invalid_ids");
  }
  const anyStillPending = rows.some((r) => r.confirmation_status === "pending");
  if (anyStillPending) {
    throw new Error("attendance_checks_update_failed");
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
  const rpcSucceeded = !rpcError && Number.isFinite(n) && n > 0;
  if (!rpcSucceeded) {
    try {
      await applyApprovalDecisionsViaDirectUpdate(uniqueIds, decision);
    } catch (e) {
      if (rpcError) {
        throw new Error(`${formatPostgrestLikeError(rpcError)} | ${formatPostgrestLikeError(e)}`);
      }
      throw e;
    }
  }

  if (idempotencyKey) {
    await markIdempotencyKeyProcessedForScope(idempotencyKey, "approval_sync");
  }
}

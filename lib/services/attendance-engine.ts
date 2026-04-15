import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type AttendanceStatus = "present" | "absent" | "half";

type SubmitPayload = {
  items: Array<{ worker_id: number; status: AttendanceStatus }>;
  workDate: string;
  note: string;
  idempotencyKey?: string | null;
};

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
  idempotencyKey,
}: SubmitPayload) {
  if (items.length === 0) return;
  if (idempotencyKey && (await hasProcessedIdempotencyKey(idempotencyKey))) return;

  const supabase = createSupabaseAdminClient();
  const workerIds = items.map((item) => item.worker_id);
  const { data: workers, error: workerError } = await supabase
    .from("workers")
    .select("id, current_site_id")
    .in("id", workerIds);

  if (workerError || !workers || workers.length === 0) return;

  const siteMap = new Map<number, Array<{ worker_id: number; status: AttendanceStatus }>>();
  const workerSiteMap = new Map<number, number>();

  for (const worker of workers as Array<{ id: number; current_site_id: number | null }>) {
    if (worker.current_site_id) {
      workerSiteMap.set(worker.id, worker.current_site_id);
    }
  }

  for (const item of items) {
    const siteId = workerSiteMap.get(item.worker_id);
    if (!siteId) continue;
    const current = siteMap.get(siteId) ?? [];
    current.push(item);
    siteMap.set(siteId, current);
  }

  for (const [siteId, payload] of siteMap.entries()) {
    const { data: round, error: roundError } = await supabase.rpc("start_attendance_round", {
      p_site_id: siteId,
      p_work_date: workDate,
      p_round_no: null,
      p_notes: note,
    });
    if (roundError || !round?.id) continue;

    await supabase.rpc("submit_attendance_checks", {
      p_round_id: round.id,
      p_payload: payload,
    });
  }

  if (idempotencyKey) {
    await markIdempotencyKeyProcessed(idempotencyKey);
  }
}

import type { WorkerRow } from "@/lib/types/db";

/** يطابق شرط الـ RPC: workers.current_site_id مطلوب لإنشاء جولة وربط التحضير. */
export function workerHasSiteForPrep(w: Pick<WorkerRow, "current_site_id">): boolean {
  const sid = w.current_site_id;
  return sid != null && Number.isFinite(Number(sid)) && Number(sid) > 0;
}

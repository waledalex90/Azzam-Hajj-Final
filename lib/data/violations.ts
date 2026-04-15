import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaginationMeta, ViolationRow } from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";

type ViolationsPageParams = {
  page: number;
  pageSize: number;
  siteId?: number;
  status?: "pending_review" | "needs_more_info" | "approved" | "rejected";
};

export async function getViolationsPage({
  page,
  pageSize,
  siteId,
  status,
}: ViolationsPageParams): Promise<{ rows: ViolationRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("worker_violations")
    .select(
      "id, worker_id, site_id, description, status, occurred_at, workers(name,id_number), sites(name), violation_types(name_ar)",
      { count: "exact" },
    )
    .order("occurred_at", { ascending: false });

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    throw new Error(`Violations query failed: ${error.message}`);
  }

  const totalRows = count ?? 0;
  return {
    rows: (data as ViolationRow[]) ?? [],
    meta: buildPaginationMeta(totalRows, page, pageSize),
  };
}

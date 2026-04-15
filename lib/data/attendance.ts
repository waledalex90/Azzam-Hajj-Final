import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AttendanceDayStats, PaginationMeta, SiteOption, WorkerRow } from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";

type WorkersPageParams = {
  page: number;
  pageSize: number;
  siteId?: number;
  search?: string;
};

type RawWorkerRow = Omit<WorkerRow, "sites"> & {
  sites?: { name: string } | { name: string }[] | null;
};

export async function getAttendanceWorkersPage({
  page,
  pageSize,
  siteId,
  search,
}: WorkersPageParams): Promise<{ rows: WorkerRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("workers")
    .select("id, name, id_number, current_site_id, is_active, is_deleted, sites(name)", {
      count: "exact",
    })
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("id", { ascending: true });

  if (siteId) {
    query = query.eq("current_site_id", siteId);
  }

  if (search && search.trim()) {
    const value = search.trim();
    query = query.or(`name.ilike.%${value}%,id_number.ilike.%${value}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    throw new Error(`Attendance workers query failed: ${error.message}`);
  }

  const totalRows = count ?? 0;
  const rows: WorkerRow[] =
    ((data as RawWorkerRow[]) ?? []).map((item) => ({
      ...item,
      sites: Array.isArray(item.sites) ? (item.sites[0] ?? null) : (item.sites ?? null),
    })) ?? [];

  return {
    rows,
    meta: buildPaginationMeta(totalRows, page, pageSize),
  };
}

export async function getSiteOptions(): Promise<SiteOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("sites").select("id, name").order("name");
  if (error) {
    throw new Error(`Sites query failed: ${error.message}`);
  }
  return (data as SiteOption[]) ?? [];
}

export async function getAttendanceDayStats(workDate: string, siteId?: number): Promise<AttendanceDayStats> {
  const supabase = createSupabaseAdminClient();

  let totalWorkersQ = supabase
    .from("workers")
    .select("*", { count: "exact", head: true })
    .eq("is_active", true)
    .eq("is_deleted", false);
  if (siteId) totalWorkersQ = totalWorkersQ.eq("current_site_id", siteId);

  let presentQ = supabase
    .from("attendance_daily_summary")
    .select("*", { count: "exact", head: true })
    .eq("work_date", workDate)
    .eq("final_status", "present");
  let absentQ = supabase
    .from("attendance_daily_summary")
    .select("*", { count: "exact", head: true })
    .eq("work_date", workDate)
    .eq("final_status", "absent");
  let halfQ = supabase
    .from("attendance_daily_summary")
    .select("*", { count: "exact", head: true })
    .eq("work_date", workDate)
    .eq("final_status", "half");

  if (siteId) {
    presentQ = presentQ.eq("site_id", siteId);
    absentQ = absentQ.eq("site_id", siteId);
    halfQ = halfQ.eq("site_id", siteId);
  }

  const [
    { count: total, error: totalErr },
    { count: present, error: presentErr },
    { count: absent, error: absentErr },
    { count: half, error: halfErr },
  ] = await Promise.all([totalWorkersQ, presentQ, absentQ, halfQ]);

  if (totalErr) throw new Error(`Attendance total workers failed: ${totalErr.message}`);
  if (presentErr) throw new Error(`Attendance present count failed: ${presentErr.message}`);
  if (absentErr) throw new Error(`Attendance absent count failed: ${absentErr.message}`);
  if (halfErr) throw new Error(`Attendance half count failed: ${halfErr.message}`);

  const totalNum = total ?? 0;
  const presentNum = present ?? 0;
  const absentNum = absent ?? 0;
  const halfNum = half ?? 0;
  const pendingNum = Math.max(0, totalNum - (presentNum + absentNum + halfNum));

  return {
    total: totalNum,
    pending: pendingNum,
    present: presentNum,
    absent: absentNum,
    half: halfNum,
  };
}

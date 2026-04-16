import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { unstable_cache } from "next/cache";
import type {
  AttendanceCheckRow,
  AttendanceDayStats,
  ContractorOption,
  PaginationMeta,
  SiteOption,
  WorkerRow,
} from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";

type WorkersPageParams = {
  page: number;
  pageSize: number;
  siteId?: number;
  contractorId?: number;
  search?: string;
};

type RawWorkerRow = Omit<WorkerRow, "sites"> & {
  sites?: { name: string } | { name: string }[] | null;
  contractors?: { name: string } | { name: string }[] | null;
};

type ChecksPageParams = {
  page: number;
  pageSize: number;
  workDate?: string;
  siteId?: number;
  search?: string;
  status?: "present" | "absent" | "half";
  confirmationStatus?: "pending" | "confirmed" | "rejected";
};

type RawAttendanceCheckRow = Omit<AttendanceCheckRow, "attendance_rounds" | "workers" | "sites"> & {
  attendance_rounds?:
    | {
        work_date: string;
        round_no: number;
        site_id: number;
        sites?: { name: string } | { name: string }[] | null;
      }[]
    | null;
  workers?: { name: string; id_number: string } | { name: string; id_number: string }[] | null;
};

export async function getAttendanceLatestStatusMap(
  workDate: string,
  workerIds: number[],
): Promise<Record<number, "present" | "absent" | "half">> {
  const uniqueIds = Array.from(new Set(workerIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attendance_checks")
    .select("worker_id, status, checked_at, attendance_rounds!inner(work_date)")
    .in("worker_id", uniqueIds)
    .eq("attendance_rounds.work_date", workDate)
    .order("checked_at", { ascending: false });

  if (error || !data) return {};

  const map: Record<number, "present" | "absent" | "half"> = {};
  for (const row of data as Array<{
    worker_id: number;
    status: "present" | "absent" | "half";
  }>) {
    if (!map[row.worker_id]) {
      map[row.worker_id] = row.status;
    }
  }
  return map;
}

/** أحدث check_id لكل عامل في التاريخ (لطلبات التعديل وربط correction_requests). */
export async function getAttendanceCheckIdMap(
  workDate: string,
  workerIds: number[],
): Promise<Record<number, number>> {
  const uniqueIds = Array.from(new Set(workerIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attendance_checks")
    .select("id, worker_id, checked_at, attendance_rounds!inner(work_date)")
    .in("worker_id", uniqueIds)
    .eq("attendance_rounds.work_date", workDate)
    .order("checked_at", { ascending: false });

  if (error || !data) return {};

  const map: Record<number, number> = {};
  for (const row of data as Array<{ id: number; worker_id: number }>) {
    if (!map[row.worker_id]) {
      map[row.worker_id] = row.id;
    }
  }
  return map;
}

/** كل معرفات السجلات المعلّقة (اعتماد ميداني) للتاريخ/الموقع/البحث — بدون ترقيم صفحات. */
export async function getPendingApprovalCheckIds(params: {
  workDate: string;
  siteId?: number;
  search?: string;
}): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("attendance_checks")
    .select("id, attendance_rounds!inner(work_date, site_id), workers!inner(name, id_number)")
    .eq("confirmation_status", "pending")
    .eq("attendance_rounds.work_date", params.workDate);

  if (params.siteId) {
    query = query.eq("attendance_rounds.site_id", params.siteId);
  }
  if (params.search?.trim()) {
    const v = params.search.trim();
    query = query.or(`workers.name.ilike.%${v}%,workers.id_number.ilike.%${v}%`);
  }

  const { data, error } = await query.limit(20000);
  if (error || !data) return [];

  return (data as Array<{ id: number }>).map((r) => r.id).filter(Boolean);
}

export async function getAttendanceWorkersPage({
  page,
  pageSize,
  siteId,
  contractorId,
  search,
}: WorkersPageParams): Promise<{ rows: WorkerRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("workers")
    .select(
      "id, name, id_number, contractor_id, current_site_id, is_active, is_deleted, sites(name), contractors(name)",
      {
      count: "planned",
      },
    )
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("id", { ascending: true });

  if (siteId) {
    query = query.eq("current_site_id", siteId);
  }
  if (contractorId) {
    query = query.eq("contractor_id", contractorId);
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
      contractors: Array.isArray(item.contractors)
        ? (item.contractors[0] ?? null)
        : (item.contractors ?? null),
    })) ?? [];

  return {
    rows,
    meta: buildPaginationMeta(totalRows, page, pageSize),
  };
}

export async function getAttendanceWorkerIdsForFilters({
  siteId,
  contractorId,
  search,
}: Omit<WorkersPageParams, "page" | "pageSize">): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let from = 0;
  const ids: number[] = [];

  while (true) {
    let query = supabase
      .from("workers")
      .select("id")
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("id", { ascending: true });

    if (siteId) {
      query = query.eq("current_site_id", siteId);
    }
    if (contractorId) {
      query = query.eq("contractor_id", contractorId);
    }
    if (search && search.trim()) {
      const value = search.trim();
      query = query.or(`name.ilike.%${value}%,id_number.ilike.%${value}%`);
    }

    const { data, error } = await query.range(from, from + pageSize - 1);
    if (error) {
      throw new Error(`Attendance worker ids query failed: ${error.message}`);
    }

    const chunk = ((data ?? []) as Array<{ id: number }>).map((item) => item.id).filter(Boolean);
    ids.push(...chunk);

    if (chunk.length < pageSize) break;
    from += pageSize;
  }

  return ids;
}

const getSiteOptionsCached = unstable_cache(
  async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase.from("sites").select("id, name").order("name");
    if (error) {
      throw new Error(`Sites query failed: ${error.message}`);
    }
    return (data as SiteOption[]) ?? [];
  },
  ["sites-options-v1"],
  { revalidate: 300, tags: ["sites-options"] },
);

export async function getSiteOptions(): Promise<SiteOption[]> {
  return getSiteOptionsCached();
}

const getContractorOptionsCached = unstable_cache(
  async () => {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("contractors")
      .select("id, name")
      .eq("is_active", true)
      .order("name");
    if (error) {
      throw new Error(`Contractors query failed: ${error.message}`);
    }
    return (data as ContractorOption[]) ?? [];
  },
  ["contractors-options-v1"],
  { revalidate: 300, tags: ["contractors-options"] },
);

export async function getContractorOptions(): Promise<ContractorOption[]> {
  return getContractorOptionsCached();
}

export async function getAttendanceDayStats(workDate: string, siteId?: number): Promise<AttendanceDayStats> {
  const supabase = createSupabaseAdminClient();
  const safeCount = async <T>(query: PromiseLike<{ count: number | null; error: T | null }>) => {
    const { count, error } = await query;
    return error ? 0 : (count ?? 0);
  };

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

  const [totalNum, presentNum, absentNum, halfNum] = await Promise.all([
    safeCount(totalWorkersQ),
    safeCount(presentQ),
    safeCount(absentQ),
    safeCount(halfQ),
  ]);
  const pendingNum = Math.max(0, totalNum - (presentNum + absentNum + halfNum));

  return {
    total: totalNum,
    pending: pendingNum,
    present: presentNum,
    absent: absentNum,
    half: halfNum,
  };
}

export async function getAttendanceChecksPage({
  page,
  pageSize,
  workDate,
  siteId,
  search,
  status,
  confirmationStatus,
}: ChecksPageParams): Promise<{ rows: AttendanceCheckRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("attendance_checks")
    .select(
      "id, round_id, worker_id, status, confirmation_status, checked_at, confirm_note, attendance_rounds!inner(work_date, round_no, site_id, sites(name)), workers(name, id_number)",
      { count: "planned" },
    )
    .order("checked_at", { ascending: false });

  if (confirmationStatus) {
    query = query.eq("confirmation_status", confirmationStatus);
  }
  if (status) {
    query = query.eq("status", status);
  }

  if (workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    query = query.eq("attendance_rounds.work_date", workDate);
  }

  if (siteId) {
    query = query.eq("attendance_rounds.site_id", siteId);
  }

  if (search && search.trim()) {
    const value = search.trim();
    query = query.or(`workers.name.ilike.%${value}%,workers.id_number.ilike.%${value}%`);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    throw new Error(`Attendance checks query failed: ${error.message}`);
  }

  const rows =
    ((data as RawAttendanceCheckRow[]) ?? []).map((item) => ({
      ...item,
      attendance_rounds: item.attendance_rounds?.[0]
        ? {
            work_date: item.attendance_rounds[0].work_date,
            round_no: item.attendance_rounds[0].round_no,
            site_id: item.attendance_rounds[0].site_id,
          }
        : null,
      workers: Array.isArray(item.workers) ? (item.workers[0] ?? null) : (item.workers ?? null),
      sites: Array.isArray(item.attendance_rounds?.[0]?.sites)
        ? (item.attendance_rounds?.[0]?.sites?.[0] ?? null)
        : (item.attendance_rounds?.[0]?.sites ?? null),
    })) ?? [];

  return {
    rows,
    meta: buildPaginationMeta(count ?? 0, page, pageSize),
  };
}

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

/** 1 = صباحي، 2 = مسائي — يطابق attendance_rounds.round_no */
export const SHIFT_ROUND = { morning: 1, evening: 2 } as const;

export function normalizeShiftRound(value: unknown): 1 | 2 {
  const n = Number(value);
  return n === 2 ? 2 : 1;
}

type WorkersPageParams = {
  page: number;
  pageSize: number;
  siteId?: number;
  contractorId?: number;
  search?: string;
  /** يُستبعد من قائمة التحضير من لديهم سجل حضور لهذا التاريخ (ربط attendance_checks + attendance_rounds) */
  workDate?: string;
  /** وردية التحضير: 1 صباحي، 2 مسائي — المسائي يستبعد من حضّر صباحاً */
  roundNo?: number;
  /**
   * عند التحضير: يقتصر على عمال بـ shift_round مطابق أو فارغ (من عمود الوردية في Excel).
   * لا يُستخدم في صفحات أخرى (مثل نقل الموظفين بدون تاريخ).
   */
  shiftRoundFilter?: number;
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
  /** فلترة مراجعة/اعتماد حسب الوردية */
  roundNo?: number;
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
  roundNo: number = SHIFT_ROUND.morning,
): Promise<Record<number, "present" | "absent" | "half">> {
  const uniqueIds = Array.from(new Set(workerIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const r = normalizeShiftRound(roundNo);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attendance_checks")
    .select("worker_id, status, checked_at, attendance_rounds!inner(work_date, round_no)")
    .in("worker_id", uniqueIds)
    .eq("attendance_rounds.work_date", workDate)
    .eq("attendance_rounds.round_no", r)
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
  roundNo: number = SHIFT_ROUND.morning,
): Promise<Record<number, number>> {
  const uniqueIds = Array.from(new Set(workerIds.filter(Boolean)));
  if (uniqueIds.length === 0) return {};

  const r = normalizeShiftRound(roundNo);
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("attendance_checks")
    .select("id, worker_id, checked_at, attendance_rounds!inner(work_date, round_no)")
    .in("worker_id", uniqueIds)
    .eq("attendance_rounds.work_date", workDate)
    .eq("attendance_rounds.round_no", r)
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
  roundNo?: number;
}): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("attendance_checks")
    .select("id, attendance_rounds!inner(work_date, site_id, round_no), workers!inner(name, id_number)")
    .eq("confirmation_status", "pending")
    .eq("attendance_rounds.work_date", params.workDate);

  if (params.siteId) {
    query = query.eq("attendance_rounds.site_id", params.siteId);
  }
  if (params.roundNo !== undefined && Number.isFinite(params.roundNo)) {
    query = query.eq("attendance_rounds.round_no", normalizeShiftRound(params.roundNo));
  }
  if (params.search?.trim()) {
    const v = params.search.trim();
    query = query.or(`workers.name.ilike.%${v}%,workers.id_number.ilike.%${v}%`);
  }

  const { data, error } = await query.limit(50000);
  if (error || !data) return [];

  return (data as Array<{ id: number }>).map((r) => r.id).filter(Boolean);
}

/** تحميل كامل بدون ترقيم صفحات — حتى ~كل العمال النشطين في نطاق الفلتر */
const PREP_WORKERS_PAGE_SIZE = 50000;

/**
 * عمال لديهم صف `attendance_checks` لهذا التاريخ (أي `attendance_checks.id` موجود).
 *
 * معادلة «معلق التحضير» في SQL (فكرة check غير موجود = لا صف بعد):
 * ```sql
 * SELECT w.* FROM workers w
 * WHERE NOT EXISTS (
 *   SELECT 1 FROM attendance_checks ac
 *   INNER JOIN attendance_rounds ar ON ar.id = ac.round_id
 *   WHERE ac.worker_id = w.id AND ar.work_date = :work_date
 *     AND (:site_id IS NULL OR ar.site_id = :site_id)
 * )
 * ```
 * (صياغة «WHERE check_id IS NULL» تُقصد بها عدم وجود صف تحضير لليوم قبل الإنشاء.)
 */
/** عمال لديهم سجل تحضير في هذه الوردية (round_no) لهذا اليوم. */
export async function getPreppedWorkerIdsForDate(
  workDate: string,
  siteId?: number,
  roundNo: number = SHIFT_ROUND.morning,
): Promise<number[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return [];
  const r = normalizeShiftRound(roundNo);
  const supabase = createSupabaseAdminClient();
  let query = supabase
    .from("attendance_checks")
    .select("worker_id, attendance_rounds!inner(work_date, site_id, round_no)")
    .eq("attendance_rounds.work_date", workDate)
    .eq("attendance_rounds.round_no", r);
  if (siteId !== undefined && Number.isFinite(siteId)) {
    query = query.eq("attendance_rounds.site_id", siteId);
  }
  const { data, error } = await query.limit(50000);
  if (error || !data) return [];
  const ids = (data as Array<{ worker_id: number }>).map((row) => row.worker_id).filter(Boolean);
  return Array.from(new Set(ids));
}

/** من يُستبعدون من قائمة التحضير للوردية الحالية: المسائي يستبعد صباحي+مسائي. */
export async function getPrepExclusionWorkerIds(
  workDate: string,
  siteId: number | undefined,
  roundNo: number,
): Promise<number[]> {
  const r = normalizeShiftRound(roundNo);
  const evening = r === SHIFT_ROUND.evening;
  const forShift = await getPreppedWorkerIdsForDate(workDate, siteId, r);
  if (!evening) return forShift;
  const morning = await getPreppedWorkerIdsForDate(workDate, siteId, SHIFT_ROUND.morning);
  return Array.from(new Set([...forShift, ...morning]));
}

/** إحصائيات تبويب التحضير: نفس نطاق الفلتر، مع استبعاد المُحضَّرين حسب الوردية وحساب الحالات لهذه الوردية فقط. */
export async function getAttendancePrepTabStats(
  workDate: string,
  siteId?: number,
  contractorId?: number,
  search?: string,
  roundNo: number = SHIFT_ROUND.morning,
): Promise<AttendanceDayStats> {
  const r = normalizeShiftRound(roundNo);
  const filteredIds = await getAttendanceWorkerIdsForFilters({
    siteId,
    contractorId,
    search,
    shiftRoundFilter: r,
  });
  const total = filteredIds.length;
  if (total === 0) return { total: 0, pending: 0, present: 0, absent: 0, half: 0 };

  const excludeList = await getPrepExclusionWorkerIds(workDate, siteId, r);
  const excludeSet = new Set(excludeList);
  const pending = filteredIds.filter((id) => !excludeSet.has(id)).length;

  const preppedThisRound = await getPreppedWorkerIdsForDate(workDate, siteId, r);
  const preppedInFilter = filteredIds.filter((id) => preppedThisRound.includes(id));
  let present = 0;
  let absent = 0;
  let half = 0;

  const CH = 400;
  const supabase = createSupabaseAdminClient();
  for (let i = 0; i < preppedInFilter.length; i += CH) {
    const chunk = preppedInFilter.slice(i, i + CH);
    let q = supabase
      .from("attendance_checks")
      .select("status, attendance_rounds!inner(work_date, round_no)")
      .in("worker_id", chunk)
      .eq("attendance_rounds.work_date", workDate)
      .eq("attendance_rounds.round_no", r);
    if (siteId !== undefined && Number.isFinite(siteId)) {
      q = q.eq("attendance_rounds.site_id", siteId);
    }
    const { data, error } = await q;
    if (error || !data) continue;
    for (const row of data as Array<{ status: string }>) {
      if (row.status === "present") present++;
      else if (row.status === "absent") absent++;
      else if (row.status === "half") half++;
    }
  }

  return { total, pending, present, absent, half };
}

export async function getAttendanceWorkersPage({
  page,
  pageSize,
  siteId,
  contractorId,
  search,
  workDate,
  roundNo,
  shiftRoundFilter,
}: WorkersPageParams): Promise<{ rows: WorkerRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  const rn = normalizeShiftRound(roundNo);
  let preppedExclude: number[] | null = null;
  if (workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    preppedExclude = await getPrepExclusionWorkerIds(workDate, siteId, rn);
  }

  const shiftToFilter =
    workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate)
      ? rn
      : shiftRoundFilter !== undefined
        ? normalizeShiftRound(shiftRoundFilter)
        : undefined;

  let query = supabase
    .from("workers")
    .select(
      "id, name, id_number, contractor_id, current_site_id, shift_round, is_active, is_deleted, sites(name), contractors(name)",
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

  if (shiftToFilter !== undefined) {
    query = query.or(`shift_round.is.null,shift_round.eq.${shiftToFilter}`);
  }

  if (preppedExclude && preppedExclude.length > 0) {
    query = query.not("id", "in", `(${preppedExclude.join(",")})`);
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

/** كل عمال التحضير المعلقين دفعة واحدة (حتى PREP_WORKERS_PAGE_SIZE) — للبحث الفوري على العميل. */
export async function getAllPendingPrepWorkers(
  params: Omit<WorkersPageParams, "page" | "pageSize">,
): Promise<{ rows: WorkerRow[]; meta: PaginationMeta }> {
  return getAttendanceWorkersPage({
    ...params,
    page: 1,
    pageSize: PREP_WORKERS_PAGE_SIZE,
  });
}

export async function getAttendanceWorkerIdsForFilters({
  siteId,
  contractorId,
  search,
  workDate,
  roundNo,
  shiftRoundFilter,
}: Omit<WorkersPageParams, "page" | "pageSize">): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  let from = 0;
  const ids: number[] = [];

  let preppedExclude: number[] | null = null;
  if (workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    preppedExclude = await getPrepExclusionWorkerIds(workDate, siteId, normalizeShiftRound(roundNo));
  }

  const shiftF =
    shiftRoundFilter !== undefined
      ? normalizeShiftRound(shiftRoundFilter)
      : workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate) && roundNo !== undefined
        ? normalizeShiftRound(roundNo)
        : undefined;

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

    if (shiftF !== undefined) {
      query = query.or(`shift_round.is.null,shift_round.eq.${shiftF}`);
    }

    if (preppedExclude && preppedExclude.length > 0) {
      query = query.not("id", "in", `(${preppedExclude.join(",")})`);
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

/** إحصائيات اليوم: بدون فلتر مقاول/بحث — استعلامات aggregate سريعة (مثل لوحة التحكم). */
async function getAttendanceDayStatsUnscoped(workDate: string, siteId?: number): Promise<AttendanceDayStats> {
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

const SUMMARY_CHUNK = 450;

/**
 * إحصائيات اليوم مرتبطة بنطاق العمال (موقع + مقاول + بحث) كما في جدول التحضير.
 * عند وجود مقاول أو بحث نحدّد العمال ثم نجمع من attendance_daily_summary على دفعات.
 */
async function getAttendanceDayStatsFiltered(
  workDate: string,
  siteId: number | undefined,
  contractorId: number | undefined,
  search: string | undefined,
): Promise<AttendanceDayStats> {
  const supabase = createSupabaseAdminClient();
  const filteredIds = await getAttendanceWorkerIdsForFilters({
    siteId,
    contractorId,
    search,
  });

  const totalNum = filteredIds.length;
  if (totalNum === 0) {
    return { total: 0, pending: 0, present: 0, absent: 0, half: 0 };
  }

  let presentNum = 0;
  let absentNum = 0;
  let halfNum = 0;

  for (let i = 0; i < filteredIds.length; i += SUMMARY_CHUNK) {
    const chunk = filteredIds.slice(i, i + SUMMARY_CHUNK);
    let q = supabase
      .from("attendance_daily_summary")
      .select("final_status")
      .eq("work_date", workDate)
      .in("worker_id", chunk);
    if (siteId !== undefined) {
      q = q.eq("site_id", siteId);
    }
    const { data, error } = await q;
    if (error) {
      throw new Error(`attendance_daily_summary (filtered) failed: ${error.message}`);
    }
    for (const row of (data ?? []) as Array<{ final_status: string }>) {
      if (row.final_status === "present") presentNum++;
      else if (row.final_status === "absent") absentNum++;
      else if (row.final_status === "half") halfNum++;
    }
  }

  const pendingNum = Math.max(0, totalNum - presentNum - absentNum - halfNum);
  return {
    total: totalNum,
    pending: pendingNum,
    present: presentNum,
    absent: absentNum,
    half: halfNum,
  };
}

/**
 * @param siteId موقع العامل الحالي (فلتر الجدول)
 * @param contractorId فلتر المقاول كما في جدول التحضير
 * @param search بحث الاسم/الهوية — يضيّق العدادات مع نطاق الجدول
 */
export async function getAttendanceDayStats(
  workDate: string,
  siteId?: number,
  contractorId?: number,
  search?: string,
): Promise<AttendanceDayStats> {
  const sid = siteId && Number.isFinite(siteId) ? siteId : undefined;
  const cid = contractorId && Number.isFinite(contractorId) ? contractorId : undefined;
  const searchTrim = search?.trim() || undefined;

  if (cid !== undefined || Boolean(searchTrim)) {
    return getAttendanceDayStatsFiltered(workDate, sid, cid, searchTrim);
  }

  return getAttendanceDayStatsUnscoped(workDate, sid);
}

/** بطاقات مراجعة/اعتماد حسب السجلات المحمّلة لهذه الوردية */
export function summarizeAttendanceChecksForRound(rows: AttendanceCheckRow[]): AttendanceDayStats {
  let pendingApproval = 0;
  let present = 0;
  let absent = 0;
  let half = 0;
  for (const r of rows) {
    if (r.confirmation_status === "pending") pendingApproval++;
    if (r.status === "present") present++;
    else if (r.status === "absent") absent++;
    else if (r.status === "half") half++;
  }
  return {
    total: rows.length,
    pending: pendingApproval,
    present,
    absent,
    half,
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
  roundNo,
}: ChecksPageParams): Promise<{ rows: AttendanceCheckRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  const workerSelect =
    search && search.trim() ? "workers!inner(name, id_number)" : "workers(name, id_number)";

  let query = supabase
    .from("attendance_checks")
    .select(
      `id, round_id, worker_id, status, confirmation_status, checked_at, confirm_note, attendance_rounds!inner(work_date, round_no, site_id, sites(name)), ${workerSelect}`,
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

  if (roundNo !== undefined && Number.isFinite(roundNo)) {
    query = query.eq("attendance_rounds.round_no", normalizeShiftRound(roundNo));
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

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
  /** عند تعيين مواقع للمستخدم في الإدارة: يُقيّد الجداول بهذه المواقع عند غياب siteId */
  allowedSiteIds?: number[];
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

/** صف عامل من workers + join مباشر على sites و contractors. */
type RawWorkerRowFlat = {
  id: number;
  name: string;
  id_number: string;
  employee_code: string | null;
  contractor_id: number | null;
  current_site_id: number | null;
  shift_round: number | null;
  is_active: boolean;
  is_deleted: boolean;
};

type RawWorkerEmbedRow = RawWorkerRowFlat & {
  sites?: { name: string } | { name: string }[] | null;
  contractors?: { name: string } | { name: string }[] | null;
};

function relationOne<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function normalizeWorkerFkId(value: unknown): number | null {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

const HYDRATE_ID_CHUNK = 200;

async function fetchIdNameMap(
  table: "sites" | "contractors",
  ids: number[],
): Promise<Map<number, string>> {
  const map = new Map<number, string>();
  if (ids.length === 0) return map;
  const supabase = createSupabaseAdminClient();
  const unique = Array.from(
    new Set(ids.map((id) => Number(id)).filter((id) => Number.isFinite(id))),
  );
  for (let o = 0; o < unique.length; o += HYDRATE_ID_CHUNK) {
    const batch = unique.slice(o, o + HYDRATE_ID_CHUNK);
    const { data, error } = await supabase.from(table).select("id, name").in("id", batch);
    if (error || !data) continue;
    for (const row of data as Array<{ id: number; name: string }>) {
      const rid = Number(row.id);
      if (Number.isFinite(rid)) map.set(rid, row.name);
    }
  }
  return map;
}

/** يملأ sites / contractors من جداول sites و contractors مباشرة حسب current_site_id و contractor_id (مصدر الحقيقة). */
export async function hydrateWorkerRowsSitesAndContractors(rows: WorkerRow[]): Promise<WorkerRow[]> {
  if (rows.length === 0) return rows;
  const siteIds = rows
    .map((r) => normalizeWorkerFkId(r.current_site_id))
    .filter((id): id is number => id != null);
  const contractorIds = rows
    .map((r) => normalizeWorkerFkId(r.contractor_id))
    .filter((id): id is number => id != null);
  const [siteMap, contractorMap] = await Promise.all([
    fetchIdNameMap("sites", siteIds),
    fetchIdNameMap("contractors", contractorIds),
  ]);
  return rows.map((r) => {
    const sid = normalizeWorkerFkId(r.current_site_id);
    const cid = normalizeWorkerFkId(r.contractor_id);
    return {
      ...r,
      current_site_id: sid,
      contractor_id: cid,
      sites: sid != null ? { name: siteMap.get(sid) ?? "—" } : null,
      contractors: cid != null ? { name: contractorMap.get(cid) ?? "—" } : null,
    };
  });
}

type ChecksPageParams = {
  page: number;
  pageSize: number;
  workDate?: string;
  siteId?: number;
  allowedSiteIds?: number[];
  /** فلتر مقاول العامل (جدول workers) — يطابق التحضير */
  contractorId?: number;
  search?: string;
  status?: "present" | "absent" | "half";
  confirmationStatus?: "pending" | "confirmed" | "rejected";
  /** فلترة مراجعة/اعتماد حسب الوردية */
  roundNo?: number;
};

const STATUS_MAP_IN_CHUNK = 500;
/** حجم دفعة التصفح المفتاحي على `workers.id` (بدون offset). */
const PREP_SCAN_CHUNK = 1000;
/** جلب صفوف العمال بعد تجميع المعرفات — أقل من حد PostgREST `max_rows` الشائع لتفادي اقتطاع الرد دون خطأ. */
const PREP_FETCH_BY_ID_CHUNK = 200;

function shouldLogAttendancePrepDebug(): boolean {
  return process.env.ATTENDANCE_PREP_DEBUG === "1" || process.env.NODE_ENV === "development";
}

function mapRawWorkerEmbedRowToWorkerRow(item: RawWorkerEmbedRow): WorkerRow {
  const current_site_id = normalizeWorkerFkId(item.current_site_id);
  const contractor_id = normalizeWorkerFkId(item.contractor_id);
  const shift_round = item.shift_round != null ? Number(item.shift_round) : null;
  return {
    ...item,
    current_site_id,
    contractor_id,
    shift_round: Number.isFinite(shift_round as number) ? shift_round : null,
    sites: relationOne(item.sites as { name: string } | null),
    contractors: relationOne(item.contractors as { name: string } | null),
  };
}

type RawAttendanceCheckRow = Omit<AttendanceCheckRow, "attendance_rounds" | "workers" | "sites" | "contractors"> & {
  attendance_rounds?:
    | {
        work_date: string;
        round_no: number;
        site_id: number;
        sites?: { name: string } | { name: string }[] | null;
      }[]
    | null;
  workers?:
    | {
        name: string;
        id_number: string;
        employee_code: string | null;
        sites?: { name: string } | { name: string }[] | null;
        contractors?: { name: string } | { name: string }[] | null;
      }
    | Array<{
        name: string;
        id_number: string;
        employee_code: string | null;
        sites?: { name: string } | { name: string }[] | null;
        contractors?: { name: string } | { name: string }[] | null;
      }>
    | null;
};

export async function getAttendanceLatestStatusMap(
  workDate: string,
  workerIds: number[],
  roundNo: number = SHIFT_ROUND.morning,
): Promise<Record<number, "present" | "absent" | "half">> {
  try {
    const uniqueIds = Array.from(new Set(workerIds.filter(Boolean)));
    if (uniqueIds.length === 0) return {};

    const r = normalizeShiftRound(roundNo);
    const supabase = createSupabaseAdminClient();
    const map: Record<number, "present" | "absent" | "half"> = {};

    for (let o = 0; o < uniqueIds.length; o += STATUS_MAP_IN_CHUNK) {
      const batch = uniqueIds.slice(o, o + STATUS_MAP_IN_CHUNK);
      const { data, error } = await supabase
        .from("attendance_checks")
        .select("worker_id, status, checked_at, attendance_rounds!inner(work_date, round_no)")
        .in("worker_id", batch)
        .eq("attendance_rounds.work_date", workDate)
        .eq("attendance_rounds.round_no", r)
        .order("checked_at", { ascending: false });

      if (error || !data) continue;

      for (const row of data as Array<{
        worker_id: number;
        status: "present" | "absent" | "half";
      }>) {
        if (!map[row.worker_id]) {
          map[row.worker_id] = row.status;
        }
      }
    }
    return map;
  } catch {
    return {};
  }
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
  const map: Record<number, number> = {};

  for (let o = 0; o < uniqueIds.length; o += STATUS_MAP_IN_CHUNK) {
    const batch = uniqueIds.slice(o, o + STATUS_MAP_IN_CHUNK);
    const { data, error } = await supabase
      .from("attendance_checks")
      .select("id, worker_id, checked_at, attendance_rounds!inner(work_date, round_no)")
      .in("worker_id", batch)
      .eq("attendance_rounds.work_date", workDate)
      .eq("attendance_rounds.round_no", r)
      .order("checked_at", { ascending: false });

    if (error || !data) continue;

    for (const row of data as Array<{ id: number; worker_id: number }>) {
      if (!map[row.worker_id]) {
        map[row.worker_id] = row.id;
      }
    }
  }
  return map;
}

/** كل معرفات السجلات المعلّقة (اعتماد ميداني) للتاريخ/الموقع/البحث — بدون ترقيم صفحات. */
export async function getPendingApprovalCheckIds(params: {
  workDate: string;
  siteId?: number;
  contractorId?: number;
  search?: string;
  roundNo?: number;
  /** تقييد مراقب ميداني/فني لمواقعه — يطابق getAttendanceChecksPage */
  allowedSiteIds?: number[];
}): Promise<number[]> {
  if (params.allowedSiteIds !== undefined && params.allowedSiteIds.length === 0) {
    return [];
  }
  const supabase = createSupabaseAdminClient();
  const cid = params.contractorId && Number.isFinite(params.contractorId) ? params.contractorId : undefined;
  const workerSelect = cid
    ? "workers!inner(name, id_number, employee_code, contractor_id)"
    : "workers!inner(name, id_number, employee_code)";
  let query = supabase
    .from("attendance_checks")
    .select(`id, attendance_rounds!inner(work_date, site_id, round_no), ${workerSelect}`)
    .eq("confirmation_status", "pending")
    .eq("attendance_rounds.work_date", params.workDate);

  if (params.siteId) {
    query = query.eq("attendance_rounds.site_id", params.siteId);
  } else if (params.allowedSiteIds && params.allowedSiteIds.length > 0) {
    query = query.in("attendance_rounds.site_id", params.allowedSiteIds);
  }
  if (cid) {
    query = query.eq("workers.contractor_id", cid);
  }
  if (params.roundNo !== undefined && Number.isFinite(params.roundNo)) {
    query = query.eq("attendance_rounds.round_no", normalizeShiftRound(params.roundNo));
  }
  if (params.search?.trim()) {
    const v = params.search.trim();
    query = query.or(
      `workers.name.ilike.%${v}%,workers.id_number.ilike.%${v}%,workers.employee_code.ilike.%${v}%`,
    );
  }

  const { data, error } = await query.limit(50000);
  if (error || !data) return [];

  return (data as Array<{ id: number }>).map((r) => r.id).filter(Boolean);
}

/** أعداد اعتماد الميدان للتاريخ + الوردية + موقع/مقاول — بدون تحميل الصفوف. */
export async function getApprovalFilterCounts(params: {
  workDate: string;
  siteId?: number;
  contractorId?: number;
  roundNo: number;
  allowedSiteIds?: number[];
}): Promise<{ pending: number; confirmed: number; total: number }> {
  if (params.allowedSiteIds !== undefined && params.allowedSiteIds.length === 0) {
    return { pending: 0, confirmed: 0, total: 0 };
  }
  const supabase = createSupabaseAdminClient();
  const r = normalizeShiftRound(params.roundNo);
  const sid = params.siteId && Number.isFinite(params.siteId) ? params.siteId : undefined;
  const cid = params.contractorId && Number.isFinite(params.contractorId) ? params.contractorId : undefined;

  const workerPart = cid ? "workers!inner(id, contractor_id)" : "workers(id)";

  const run = async (confirmationStatus?: "pending" | "confirmed") => {
    let q = supabase
      .from("attendance_checks")
      .select(`id, attendance_rounds!inner(work_date, round_no, site_id), ${workerPart}`, {
        count: "exact",
        head: true,
      })
      .eq("attendance_rounds.work_date", params.workDate)
      .eq("attendance_rounds.round_no", r);
    if (sid) q = q.eq("attendance_rounds.site_id", sid);
    else if (params.allowedSiteIds && params.allowedSiteIds.length > 0) {
      q = q.in("attendance_rounds.site_id", params.allowedSiteIds);
    }
    if (cid) q = q.eq("workers.contractor_id", cid);
    if (confirmationStatus) q = q.eq("confirmation_status", confirmationStatus);
    const { count, error } = await q;
    if (error) return 0;
    return count ?? 0;
  };

  const [pending, confirmed, total] = await Promise.all([
    run("pending"),
    run("confirmed"),
    run(),
  ]);

  return { pending, confirmed, total };
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
  siteIdsScope?: number[],
): Promise<number[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return [];
  if (
    siteIdsScope !== undefined &&
    siteIdsScope.length === 0 &&
    (siteId === undefined || !Number.isFinite(siteId))
  ) {
    return [];
  }
  const r = normalizeShiftRound(roundNo);
  const supabase = createSupabaseAdminClient();
  const pageSize = 1000;
  const all: number[] = [];

  let lastCheckId = 0;
  while (true) {
    let query = supabase
      .from("attendance_checks")
      .select("id, worker_id, attendance_rounds!inner(work_date, site_id, round_no)")
      .eq("attendance_rounds.work_date", workDate)
      .eq("attendance_rounds.round_no", r)
      .order("id", { ascending: true })
      .limit(pageSize);
    if (siteId !== undefined && Number.isFinite(siteId)) {
      query = query.eq("attendance_rounds.site_id", siteId);
    } else if (siteIdsScope && siteIdsScope.length > 0) {
      query = query.in("attendance_rounds.site_id", siteIdsScope);
    }
    if (lastCheckId > 0) {
      query = query.gt("id", lastCheckId);
    }
    const { data, error } = await query;
    if (error || !data) break;
    const chunk = data as Array<{ id: number; worker_id: number }>;
    if (chunk.length === 0) break;
    for (const row of chunk) {
      if (row.worker_id) all.push(row.worker_id);
    }
    lastCheckId = Number(chunk[chunk.length - 1].id);
    if (chunk.length < pageSize) break;
  }

  return Array.from(new Set(all));
}

/** من يُستبعدون من قائمة التحضير للوردية الحالية: المسائي يستبعد صباحي+مسائي. */
export async function getPrepExclusionWorkerIds(
  workDate: string,
  siteId: number | undefined,
  roundNo: number,
  siteIdsScope?: number[],
): Promise<number[]> {
  const r = normalizeShiftRound(roundNo);
  const evening = r === SHIFT_ROUND.evening;
  const forShift = await getPreppedWorkerIdsForDate(workDate, siteId, r, siteIdsScope);
  if (!evening) return forShift;
  const morning = await getPreppedWorkerIdsForDate(workDate, siteId, SHIFT_ROUND.morning, siteIdsScope);
  return Array.from(new Set([...forShift, ...morning]));
}

/** إحصائيات تبويب التحضير: نفس نطاق الفلتر، مع استبعاد المُحضَّرين حسب الوردية وحساب الحالات لهذه الوردية فقط. */
export async function getAttendancePrepTabStats(
  workDate: string,
  siteId?: number,
  contractorId?: number,
  search?: string,
  roundNo: number = SHIFT_ROUND.morning,
  allowedSiteIds?: number[],
): Promise<AttendanceDayStats> {
  const r = normalizeShiftRound(roundNo);
  const siteIdsScope =
    siteId !== undefined && Number.isFinite(siteId) ? undefined : allowedSiteIds;
  const filteredIds = await getAttendanceWorkerIdsForFilters({
    siteId,
    allowedSiteIds,
    contractorId,
    search,
    workDate,
    roundNo: r,
    shiftRoundFilter: r,
  });
  const total = filteredIds.length;
  if (total === 0) return { total: 0, pending: 0, present: 0, absent: 0, half: 0 };

  const excludeList = await getPrepExclusionWorkerIds(workDate, siteId, r, siteIdsScope);
  const excludeSet = new Set(excludeList);
  const pending = filteredIds.filter((id) => !excludeSet.has(id)).length;

  const preppedThisRound = await getPreppedWorkerIdsForDate(workDate, siteId, r, siteIdsScope);
  const preppedInRoundSet = new Set(preppedThisRound);
  const preppedInFilter = filteredIds.filter((id) => preppedInRoundSet.has(id));
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
    } else if (siteIdsScope && siteIdsScope.length > 0) {
      q = q.in("attendance_rounds.site_id", siteIdsScope);
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

function resolvePrepShiftFilter(
  workDate: string | undefined,
  roundNo: number | undefined,
  shiftRoundFilter: number | undefined,
): number | undefined {
  if (workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return normalizeShiftRound(roundNo);
  }
  if (shiftRoundFilter !== undefined) {
    return normalizeShiftRound(shiftRoundFilter);
  }
  return undefined;
}

/**
 * كل عمال التحضير المعلقين — نفس نطاق `getAttendanceWorkerIdsForFilters` ثم جلب الصفوف بـ `in(id,…)` على دفعات.
 *
 * **ملاحظة واجهة:** حقل «بحث فوري» في `AttendancePrepWorkzone` يفلتر **نفس الصفوف المحمّلة** في المتصفح فقط؛
 * لا يُعاد استدعاء هذه الدالة بـ `search`. إن ظهر اسم بالبحث فالعامل موجود في `initialWorkers` (قد يكون بعيداً في القائمة الافتراضية).
 */
export async function getAllPendingPrepWorkers(
  params: Omit<WorkersPageParams, "page" | "pageSize">,
): Promise<{ rows: WorkerRow[]; meta: PaginationMeta }> {
  if (params.allowedSiteIds !== undefined && params.allowedSiteIds.length === 0) {
    return { rows: [], meta: buildPaginationMeta(0, 1, 1) };
  }

  const debug = shouldLogAttendancePrepDebug();
  const rn = normalizeShiftRound(params.roundNo);
  let preppedExcludeCount = 0;
  if (debug && params.workDate && /^\d{4}-\d{2}-\d{2}$/.test(params.workDate)) {
    try {
      const ex = await getPrepExclusionWorkerIds(
        params.workDate,
        params.siteId,
        rn,
        params.siteId ? undefined : params.allowedSiteIds,
      );
      preppedExcludeCount = ex.length;
    } catch {
      preppedExcludeCount = -1;
    }
  }

  const pendingIds = await getAttendanceWorkerIdsForFilters({
    siteId: params.siteId,
    allowedSiteIds: params.allowedSiteIds,
    contractorId: params.contractorId,
    search: params.search,
    workDate: params.workDate,
    roundNo: params.roundNo,
    shiftRoundFilter: params.shiftRoundFilter,
  });

  const capped = pendingIds.slice(0, PREP_WORKERS_PAGE_SIZE);
  if (capped.length === 0) {
    if (debug) {
      console.warn("[attendance:prep]", {
        message: "لا معرفات معلّقة بعد الفلترة",
        preppedWorkerIdsExcludedFromList: preppedExcludeCount,
        filters: {
          siteId: params.siteId,
          contractorId: params.contractorId,
          workDate: params.workDate,
          roundNo: rn,
        },
      });
    }
    return { rows: [], meta: buildPaginationMeta(0, 1, 1) };
  }

  const supabase = createSupabaseAdminClient();
  const rowById = new Map<number, WorkerRow>();
  const chunkStats: Array<{ requested: number; returned: number; batchIndex: number }> = [];

  for (let i = 0; i < capped.length; i += PREP_FETCH_BY_ID_CHUNK) {
    const chunk = capped.slice(i, i + PREP_FETCH_BY_ID_CHUNK);
    const batchIndex = Math.floor(i / PREP_FETCH_BY_ID_CHUNK);
    const { data, error } = await supabase
      .from("workers")
      .select(
        "id, name, id_number, employee_code, contractor_id, current_site_id, shift_round, is_active, is_deleted",
      )
      .in("id", chunk)
      .eq("is_active", true)
      .eq("is_deleted", false);

    if (error) {
      throw new Error(`getAllPendingPrepWorkers: فشل جلب دفعة عمال (${error.message})`);
    }
    const rows = (data as RawWorkerEmbedRow[]) ?? [];
    if (debug) {
      chunkStats.push({ requested: chunk.length, returned: rows.length, batchIndex });
      if (rows.length < chunk.length) {
        console.warn("[attendance:prep] دفعة in(id) أقل من المطلوب — احتمال اقتطاع max_rows أو صفوف لا تطابق is_active/is_deleted", {
          batchIndex,
          requestedIds: chunk.length,
          returnedRows: rows.length,
        });
      }
    }
    for (const raw of rows) {
      const row = mapRawWorkerEmbedRowToWorkerRow(raw);
      rowById.set(row.id, row);
    }
  }

  const missingIds = capped.filter((id) => !rowById.has(id));

  if (debug && missingIds.length > 0) {
    const sample = missingIds.slice(0, 60);
    const { data: diag } = await supabase
      .from("workers")
      .select("id, name, is_active, is_deleted, current_site_id, shift_round")
      .in("id", sample);
    const found = (diag ?? []) as Array<{
      id: number;
      name: string;
      is_active: boolean;
      is_deleted: boolean;
      current_site_id: number | null;
      shift_round: number | null;
    }>;
    const foundIds = new Set(found.map((r) => r.id));
    console.warn("[attendance:prep] معرفات في قائمة المعلّقين لكن لم تُجلب بشرط active/deleted", {
      missingCount: missingIds.length,
      sampleSize: sample.length,
      notInDbAtAll: sample.filter((id) => !foundIds.has(id)),
      inactiveOrDeleted: found.filter((r) => !r.is_active || r.is_deleted),
      presentButFilteredBySecondQuery: found.filter((r) => r.is_active && !r.is_deleted),
    });
  }

  if (debug) {
    console.warn("[attendance:prep] ملخص التحميل", {
      pendingIdCount: capped.length,
      preppedWorkersExcludedCount: preppedExcludeCount,
      notePrepped:
        preppedExcludeCount >= 0
          ? "عدد عمال لهم سجل تحضير في هذه الجولة (يُستبعدون من قائمة المعلّقين)"
          : "تعذّر حساب المستبعدين",
      rowMapSize: rowById.size,
      finalRowCountAfterOrder: capped.length - missingIds.length,
      fetchBatches: chunkStats,
      listFiltersSameAsIdsQuery:
        "getAttendanceWorkerIdsForFilters: is_active, is_deleted, current_site_id / allowedSiteIds, contractorId, shift_round OR null, workDate exclusion — بدون search من الصفحة",
    });
  }

  const allRows = capped.map((id) => rowById.get(id)).filter((r): r is WorkerRow => r != null);

  let hydrated: WorkerRow[];
  try {
    hydrated = await hydrateWorkerRowsSitesAndContractors(allRows);
  } catch {
    hydrated = allRows;
  }
  return {
    rows: hydrated,
    meta: buildPaginationMeta(hydrated.length, 1, Math.max(hydrated.length, 1)),
  };
}

export async function getAttendanceWorkerIdsForFilters({
  siteId,
  allowedSiteIds,
  contractorId,
  search,
  workDate,
  roundNo,
  shiftRoundFilter,
}: Omit<WorkersPageParams, "page" | "pageSize">): Promise<number[]> {
  if (allowedSiteIds !== undefined && allowedSiteIds.length === 0) {
    return [];
  }
  const supabase = createSupabaseAdminClient();
  const ids: number[] = [];

  let excludeList: number[] = [];
  if (workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    const rnForExclude =
      roundNo !== undefined
        ? normalizeShiftRound(roundNo)
        : shiftRoundFilter !== undefined
          ? normalizeShiftRound(shiftRoundFilter)
          : SHIFT_ROUND.morning;
    try {
      excludeList = await getPrepExclusionWorkerIds(
        workDate,
        siteId,
        rnForExclude,
        siteId ? undefined : allowedSiteIds,
      );
    } catch {
      excludeList = [];
    }
  }
  const excludeSet = new Set(excludeList);

  const shiftF = resolvePrepShiftFilter(workDate, roundNo, shiftRoundFilter);

  /** تصفح مفتاحي بـ `id` لتفادي اعتماد offset/range مع حدود PostgREST وحالات القطع الصامتة. */
  let lastWorkerId = 0;
  while (true) {
    let query = supabase
      .from("workers")
      .select("id")
      .eq("is_active", true)
      .eq("is_deleted", false)
      .order("id", { ascending: true })
      .limit(PREP_SCAN_CHUNK);

    if (lastWorkerId > 0) {
      query = query.gt("id", lastWorkerId);
    }

    if (siteId) {
      query = query.eq("current_site_id", siteId);
    } else if (allowedSiteIds && allowedSiteIds.length > 0) {
      query = query.in("current_site_id", allowedSiteIds);
    }
    if (contractorId) {
      query = query.eq("contractor_id", contractorId);
    }

    const searchTrim = search?.trim() ?? "";
    if (searchTrim) {
      const esc = searchTrim.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/,/g, "\\,");
      query = query.or(
        `name.ilike.%${esc}%,id_number.ilike.%${esc}%,employee_code.ilike.%${esc}%`,
      );
    }
    if (shiftF !== undefined) {
      query = query.or(`shift_round.is.null,shift_round.eq.${shiftF}`);
    }

    const { data, error } = await query;
    if (error) {
      break;
    }
    if (!data?.length) break;

    const rows = data as Array<{ id: number }>;
    for (const row of rows) {
      const id = Number(row.id);
      if (!Number.isFinite(id)) continue;
      if (!excludeSet.has(id)) ids.push(id);
    }

    lastWorkerId = Number(rows[rows.length - 1].id);
    if (rows.length < PREP_SCAN_CHUNK) break;
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

/** بدون unstable_cache — لصفحة التحضير فقط (أسماء المواقع/المقاولين حديثة). */
export async function getSiteOptionsLive(): Promise<SiteOption[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.from("sites").select("id, name").order("name");
  if (error) {
    throw new Error(`Sites query failed: ${error.message}`);
  }
  return (data as SiteOption[]) ?? [];
}

export async function getContractorOptionsLive(): Promise<ContractorOption[]> {
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
}

/** إحصائيات اليوم: بدون فلتر مقاول/بحث — استعلامات aggregate سريعة (مثل لوحة التحكم). */
async function getAttendanceDayStatsUnscoped(
  workDate: string,
  siteId?: number,
  allowedSiteIds?: number[],
): Promise<AttendanceDayStats> {
  if (!siteId && allowedSiteIds !== undefined && allowedSiteIds.length === 0) {
    return { total: 0, pending: 0, present: 0, absent: 0, half: 0 };
  }
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
  if (siteId) {
    totalWorkersQ = totalWorkersQ.eq("current_site_id", siteId);
  } else if (allowedSiteIds && allowedSiteIds.length > 0) {
    totalWorkersQ = totalWorkersQ.in("current_site_id", allowedSiteIds);
  }

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
  } else if (allowedSiteIds && allowedSiteIds.length > 0) {
    presentQ = presentQ.in("site_id", allowedSiteIds);
    absentQ = absentQ.in("site_id", allowedSiteIds);
    halfQ = halfQ.in("site_id", allowedSiteIds);
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
  allowedSiteIds?: number[],
): Promise<AttendanceDayStats> {
  const supabase = createSupabaseAdminClient();
  const filteredIds = await getAttendanceWorkerIdsForFilters({
    siteId,
    allowedSiteIds,
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
  allowedSiteIds?: number[],
): Promise<AttendanceDayStats> {
  const sid = siteId && Number.isFinite(siteId) ? siteId : undefined;
  const cid = contractorId && Number.isFinite(contractorId) ? contractorId : undefined;
  const searchTrim = search?.trim() || undefined;

  if (cid !== undefined || Boolean(searchTrim)) {
    return getAttendanceDayStatsFiltered(workDate, sid, cid, searchTrim, allowedSiteIds);
  }

  return getAttendanceDayStatsUnscoped(workDate, sid, allowedSiteIds);
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
  allowedSiteIds,
  contractorId,
  search,
  status,
  confirmationStatus,
  roundNo,
}: ChecksPageParams): Promise<{ rows: AttendanceCheckRow[]; meta: PaginationMeta }> {
  if (allowedSiteIds !== undefined && allowedSiteIds.length === 0) {
    return { rows: [], meta: buildPaginationMeta(0, page, pageSize) };
  }
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  const workerEmbed =
    "id, name, id_number, employee_code, current_site_id, contractor_id, sites(name), contractors(name)";
  const cid =
    contractorId !== undefined && Number.isFinite(contractorId) ? Number(contractorId) : undefined;
  const needInner =
    Boolean(search && search.trim()) || cid !== undefined;
  const workerSelect = needInner ? `workers!inner(${workerEmbed})` : `workers(${workerEmbed})`;

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
  } else if (allowedSiteIds && allowedSiteIds.length > 0) {
    query = query.in("attendance_rounds.site_id", allowedSiteIds);
  }

  if (roundNo !== undefined && Number.isFinite(roundNo)) {
    query = query.eq("attendance_rounds.round_no", normalizeShiftRound(roundNo));
  }

  if (cid !== undefined) {
    query = query.eq("workers.contractor_id", cid);
  }

  if (search && search.trim()) {
    const value = search.trim();
    query = query.or(
      `workers.name.ilike.%${value}%,workers.id_number.ilike.%${value}%,workers.employee_code.ilike.%${value}%`,
    );
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    throw new Error(`Attendance checks query failed: ${error.message}`);
  }

  const rows =
    ((data as RawAttendanceCheckRow[]) ?? []).map((item) => {
      const w = Array.isArray(item.workers) ? (item.workers[0] ?? null) : (item.workers ?? null);
      const workerSite = w ? relationOne(w.sites as { name: string } | null) : null;
      const workerContractor = w ? relationOne(w.contractors as { name: string } | null) : null;
      const roundSite = Array.isArray(item.attendance_rounds?.[0]?.sites)
        ? (item.attendance_rounds?.[0]?.sites?.[0] ?? null)
        : (item.attendance_rounds?.[0]?.sites ?? null);
      return {
        ...item,
        attendance_rounds: item.attendance_rounds?.[0]
          ? {
              work_date: item.attendance_rounds[0].work_date,
              round_no: item.attendance_rounds[0].round_no,
              site_id: item.attendance_rounds[0].site_id,
            }
          : null,
        workers: w
          ? { name: w.name, id_number: w.id_number, employee_code: w.employee_code }
          : null,
        sites: workerSite ?? roundSite,
        contractors: workerContractor ?? null,
      };
    }) ?? [];

  return {
    rows,
    meta: buildPaginationMeta(count ?? 0, page, pageSize),
  };
}

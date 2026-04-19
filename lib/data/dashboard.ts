import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAttendanceDayStats, getSiteOptions } from "@/lib/data/attendance";
import type {
  AdminDashboardData,
  DashboardStats,
  IqamaAlert,
  LatestWorker,
  PendingCorrection,
  SiteAttendanceRow,
  TopStats,
} from "@/lib/types/db";

async function safeCount(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
  const { count, error } = await query;
  if (error) {
    return 0;
  }
  return count ?? 0;
}

async function getDashboardStatsUncached(targetDate: string, siteScope?: number[]): Promise<DashboardStats> {
  const today = targetDate;
  const start = `${today}T00:00:00.000Z`;
  const end = `${today}T23:59:59.999Z`;

  const supabase = createSupabaseAdminClient();

  const day = await getAttendanceDayStats(today, undefined, undefined, undefined, siteScope);

  let violationsCount = 0;
  if (!siteScope || siteScope.length > 0) {
    let vq = supabase
      .from("worker_violations")
      .select("*", { count: "exact", head: true })
      .gte("occurred_at", start)
      .lte("occurred_at", end);
    if (siteScope && siteScope.length > 0) {
      vq = vq.in("site_id", siteScope);
    }
    violationsCount = await safeCount(vq);
  }

  return {
    presentToday: day.present,
    absentToday: day.absent,
    halfToday: day.half,
    pendingToday: day.pending,
    totalActiveWorkers: day.total,
    violationsToday: violationsCount,
  };
}

async function countDistinctContractorsForSites(siteIds: number[]): Promise<number> {
  if (siteIds.length === 0) return 0;
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("workers")
    .select("contractor_id")
    .in("current_site_id", siteIds)
    .eq("is_active", true)
    .eq("is_deleted", false)
    .not("contractor_id", "is", null);
  if (error || !data?.length) return 0;
  const set = new Set((data as Array<{ contractor_id: number }>).map((r) => r.contractor_id));
  return set.size;
}

async function getAdminDashboardDataUncached(targetDate: string, siteScope?: number[]): Promise<AdminDashboardData> {
  const supabase = createSupabaseAdminClient();
  const today = targetDate;
  const after30Days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

  if (siteScope && siteScope.length === 0) {
    return {
      topStats: { contractors: 0, inactiveWorkers: 0, activeWorkers: 0, sites: 0 },
      iqamaAlerts: [],
      pendingCorrections: [],
      latestWorkers: [],
      siteAttendanceToday: [],
    };
  }

  const scoped = siteScope && siteScope.length > 0;

  let contractors: number;
  let inactiveWorkers: number;
  let activeWorkers: number;
  let sites: number;

  if (scoped) {
    const siteIds = siteScope!;
    [inactiveWorkers, activeWorkers, contractors, sites] = await Promise.all([
      safeCount(
        supabase
          .from("workers")
          .select("*", { count: "exact", head: true })
          .eq("is_active", false)
          .eq("is_deleted", false)
          .in("current_site_id", siteIds),
      ),
      safeCount(
        supabase
          .from("workers")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("is_deleted", false)
          .in("current_site_id", siteIds),
      ),
      countDistinctContractorsForSites(siteIds),
      Promise.resolve(siteIds.length),
    ]);
  } else {
    [contractors, inactiveWorkers, activeWorkers, sites] = await Promise.all([
      safeCount(supabase.from("contractors").select("*", { count: "exact", head: true })),
      safeCount(
        supabase
          .from("workers")
          .select("*", { count: "exact", head: true })
          .eq("is_active", false)
          .eq("is_deleted", false),
      ),
      safeCount(
        supabase
          .from("workers")
          .select("*", { count: "exact", head: true })
          .eq("is_active", true)
          .eq("is_deleted", false),
      ),
      safeCount(supabase.from("sites").select("*", { count: "exact", head: true })),
    ]);
  }

  let iqamaQ = supabase
    .from("workers")
    .select("id, name, id_number, iqama_expiry")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .not("iqama_expiry", "is", null)
    .gte("iqama_expiry", today)
    .lte("iqama_expiry", after30Days)
    .order("iqama_expiry", { ascending: true })
    .limit(6);
  if (scoped) {
    iqamaQ = iqamaQ.in("current_site_id", siteScope!);
  }
  const iqamaRes = await iqamaQ;
  const iqamaAlertsRaw: IqamaAlert[] = !iqamaRes.error ? ((iqamaRes.data as IqamaAlert[]) ?? []) : [];

  let latestQ = supabase
    .from("workers")
    .select("id, name, id_number, created_at")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(8);
  if (scoped) {
    latestQ = latestQ.in("current_site_id", siteScope!);
  }
  const latestRes = await latestQ;
  const latestWorkersRaw: LatestWorker[] = !latestRes.error ? ((latestRes.data as LatestWorker[]) ?? []) : [];

  let pendingCorrections: PendingCorrection[] = [];
  const { data: correctionsRaw, error: correctionsError } = await supabase
    .from("correction_requests")
    .select("id, reason, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(6);

  if (!correctionsError) {
    pendingCorrections = (correctionsRaw as PendingCorrection[]) ?? [];
  }

  const topStats: TopStats = {
    contractors,
    inactiveWorkers,
    activeWorkers,
    sites,
  };

  let siteAttendanceToday: SiteAttendanceRow[] = [];
  try {
    const siteList = (await getSiteOptions()).filter((s) => !scoped || siteScope!.includes(s.id));
    const rows = await Promise.all(
      siteList.map(async (s) => {
        const st = await getAttendanceDayStats(today, s.id);
        return {
          siteId: s.id,
          siteName: s.name,
          totalWorkers: st.total,
          present: st.present,
          absent: st.absent,
          half: st.half,
          pending: st.pending,
        } satisfies SiteAttendanceRow;
      }),
    );
    siteAttendanceToday = rows.sort((a, b) => b.pending - a.pending || a.siteName.localeCompare(b.siteName, "ar"));
  } catch {
    siteAttendanceToday = [];
  }

  return {
    topStats,
    iqamaAlerts: iqamaAlertsRaw,
    pendingCorrections,
    latestWorkers: latestWorkersRaw,
    siteAttendanceToday,
  };
}

function resolveDashboardDate(workDate?: string): string {
  return workDate && /^\d{4}-\d{2}-\d{2}$/.test(workDate) ? workDate : new Date().toISOString().slice(0, 10);
}

export async function getDashboardStats(
  workDate?: string,
  /** `undefined` = كل المواقع؛ مصفوفة = تقييد كصفحة التحضير */
  siteScope?: number[],
): Promise<DashboardStats> {
  return getDashboardStatsUncached(resolveDashboardDate(workDate), siteScope);
}

export async function getAdminDashboardData(workDate?: string, siteScope?: number[]): Promise<AdminDashboardData> {
  return getAdminDashboardDataUncached(resolveDashboardDate(workDate), siteScope);
}

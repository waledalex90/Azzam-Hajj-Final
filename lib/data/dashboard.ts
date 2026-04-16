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

async function getDashboardStatsUncached(targetDate: string): Promise<DashboardStats> {
  const today = targetDate;
  const start = `${today}T00:00:00.000Z`;
  const end = `${today}T23:59:59.999Z`;

  const supabase = createSupabaseAdminClient();

  const [day, violationsCount] = await Promise.all([
    getAttendanceDayStats(today),
    safeCount(
      supabase
        .from("worker_violations")
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", start)
        .lte("occurred_at", end),
    ),
  ]);

  return {
    presentToday: day.present,
    absentToday: day.absent,
    halfToday: day.half,
    pendingToday: day.pending,
    totalActiveWorkers: day.total,
    violationsToday: violationsCount,
  };
}

async function getAdminDashboardDataUncached(targetDate: string): Promise<AdminDashboardData> {
  const supabase = createSupabaseAdminClient();
  const today = targetDate;
  const after30Days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

  const [contractors, inactiveWorkers, activeWorkers, sites] = await Promise.all([
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

  let iqamaAlertsRaw: IqamaAlert[] = [];
  const iqamaRes = await supabase
    .from("workers")
    .select("id, name, id_number, iqama_expiry")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .not("iqama_expiry", "is", null)
    .gte("iqama_expiry", today)
    .lte("iqama_expiry", after30Days)
    .order("iqama_expiry", { ascending: true })
    .limit(6);
  if (!iqamaRes.error) {
    iqamaAlertsRaw = (iqamaRes.data as IqamaAlert[]) ?? [];
  }

  let latestWorkersRaw: LatestWorker[] = [];
  const latestRes = await supabase
    .from("workers")
    .select("id, name, id_number, created_at")
    .eq("is_deleted", false)
    .order("created_at", { ascending: false })
    .limit(8);
  if (!latestRes.error) {
    latestWorkersRaw = (latestRes.data as LatestWorker[]) ?? [];
  }

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
    const siteList = await getSiteOptions();
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

export async function getDashboardStats(workDate?: string): Promise<DashboardStats> {
  return getDashboardStatsUncached(resolveDashboardDate(workDate));
}

export async function getAdminDashboardData(workDate?: string): Promise<AdminDashboardData> {
  return getAdminDashboardDataUncached(resolveDashboardDate(workDate));
}

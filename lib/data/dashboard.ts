import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AdminDashboardData,
  DashboardStats,
  IqamaAlert,
  LatestWorker,
  PendingCorrection,
  TopStats,
} from "@/lib/types/db";

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().slice(0, 10);
  const start = `${today}T00:00:00.000Z`;
  const end = `${today}T23:59:59.999Z`;

  const supabase = createSupabaseAdminClient();

  const [
    { count: presentCount, error: presentError },
    { count: absentCount, error: absentError },
    { count: violationsCount, error: violationsError },
  ] = await Promise.all([
    supabase
      .from("attendance_daily_summary")
      .select("*", { count: "exact", head: true })
      .eq("work_date", today)
      .eq("final_status", "present"),
    supabase
      .from("attendance_daily_summary")
      .select("*", { count: "exact", head: true })
      .eq("work_date", today)
      .eq("final_status", "absent"),
    supabase
      .from("worker_violations")
      .select("*", { count: "exact", head: true })
      .gte("occurred_at", start)
      .lte("occurred_at", end),
  ]);

  if (presentError) throw new Error(`Present count failed: ${presentError.message}`);
  if (absentError) throw new Error(`Absent count failed: ${absentError.message}`);
  if (violationsError) throw new Error(`Violations count failed: ${violationsError.message}`);

  return {
    presentToday: presentCount ?? 0,
    absentToday: absentCount ?? 0,
    violationsToday: violationsCount ?? 0,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);
  const after30Days = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString().slice(0, 10);

  const [
    { count: contractors, error: contractorsError },
    { count: inactiveWorkers, error: inactiveError },
    { count: activeWorkers, error: activeError },
    { count: sites, error: sitesError },
    { data: iqamaAlertsRaw, error: iqamaError },
    { data: latestWorkersRaw, error: latestWorkersError },
  ] = await Promise.all([
    supabase.from("contractors").select("*", { count: "exact", head: true }),
    supabase
      .from("workers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", false)
      .eq("is_deleted", false),
    supabase
      .from("workers")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true)
      .eq("is_deleted", false),
    supabase.from("sites").select("*", { count: "exact", head: true }),
    supabase
      .from("workers")
      .select("id, name, id_number, iqama_expiry")
      .eq("is_active", true)
      .eq("is_deleted", false)
      .not("iqama_expiry", "is", null)
      .gte("iqama_expiry", today)
      .lte("iqama_expiry", after30Days)
      .order("iqama_expiry", { ascending: true })
      .limit(6),
    supabase
      .from("workers")
      .select("id, name, id_number, created_at")
      .eq("is_deleted", false)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (contractorsError) throw new Error(`Contractors count failed: ${contractorsError.message}`);
  if (inactiveError) throw new Error(`Inactive workers count failed: ${inactiveError.message}`);
  if (activeError) throw new Error(`Active workers count failed: ${activeError.message}`);
  if (sitesError) throw new Error(`Sites count failed: ${sitesError.message}`);
  if (iqamaError) throw new Error(`Iqama alerts query failed: ${iqamaError.message}`);
  if (latestWorkersError) throw new Error(`Latest workers query failed: ${latestWorkersError.message}`);

  let pendingCorrections: PendingCorrection[] = [];
  const { data: correctionsRaw, error: correctionsError } = await supabase
    .from("correction_requests")
    .select("id, reason, created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(6);

  if (!correctionsError) {
    pendingCorrections = (correctionsRaw as PendingCorrection[]) ?? [];
  } else {
    // Table may not exist in new schema yet; keep dashboard resilient.
    const code = String(correctionsError.code || "");
    const msg = String(correctionsError.message || "").toLowerCase();
    const knownMissing = code === "42P01" || msg.includes("does not exist");
    if (!knownMissing) {
      throw new Error(`Pending corrections query failed: ${correctionsError.message}`);
    }
  }

  const topStats: TopStats = {
    contractors: contractors ?? 0,
    inactiveWorkers: inactiveWorkers ?? 0,
    activeWorkers: activeWorkers ?? 0,
    sites: sites ?? 0,
  };

  return {
    topStats,
    iqamaAlerts: (iqamaAlertsRaw as IqamaAlert[]) ?? [],
    pendingCorrections,
    latestWorkers: (latestWorkersRaw as LatestWorker[]) ?? [],
  };
}

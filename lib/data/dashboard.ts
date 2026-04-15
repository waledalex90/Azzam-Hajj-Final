import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  AdminDashboardData,
  DashboardStats,
  IqamaAlert,
  LatestWorker,
  PendingCorrection,
  TopStats,
} from "@/lib/types/db";

function isMissingObjectError(error: unknown) {
  const code = String((error as { code?: string } | null)?.code ?? "");
  const msg = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
  return code === "42P01" || code === "PGRST200" || msg.includes("does not exist") || msg.includes("not found");
}

async function safeCount(query: PromiseLike<{ count: number | null; error: { message?: string } | null }>) {
  const { count, error } = await query;
  if (error) {
    if (isMissingObjectError(error)) return 0;
    throw new Error(error.message || "Count query failed");
  }
  return count ?? 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const today = new Date().toISOString().slice(0, 10);
  const start = `${today}T00:00:00.000Z`;
  const end = `${today}T23:59:59.999Z`;

  const supabase = createSupabaseAdminClient();

  const [presentCount, absentCount, violationsCount] = await Promise.all([
    safeCount(
      supabase
        .from("attendance_daily_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_date", today)
        .eq("final_status", "present"),
    ),
    safeCount(
      supabase
        .from("attendance_daily_summary")
        .select("*", { count: "exact", head: true })
        .eq("work_date", today)
        .eq("final_status", "absent"),
    ),
    safeCount(
      supabase
        .from("worker_violations")
        .select("*", { count: "exact", head: true })
        .gte("occurred_at", start)
        .lte("occurred_at", end),
    ),
  ]);

  return {
    presentToday: presentCount,
    absentToday: absentCount,
    violationsToday: violationsCount,
  };
}

export async function getAdminDashboardData(): Promise<AdminDashboardData> {
  const supabase = createSupabaseAdminClient();
  const today = new Date().toISOString().slice(0, 10);
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
  } else if (!isMissingObjectError(iqamaRes.error)) {
    throw new Error(`Iqama alerts query failed: ${iqamaRes.error.message}`);
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
  } else if (!isMissingObjectError(latestRes.error)) {
    throw new Error(`Latest workers query failed: ${latestRes.error.message}`);
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
    contractors,
    inactiveWorkers,
    activeWorkers,
    sites,
  };

  return {
    topStats,
    iqamaAlerts: iqamaAlertsRaw,
    pendingCorrections,
    latestWorkers: latestWorkersRaw,
  };
}

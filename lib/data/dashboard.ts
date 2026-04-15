import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { DashboardStats } from "@/lib/types/db";

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

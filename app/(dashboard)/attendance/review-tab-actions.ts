"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export async function reviewAttendanceCheck(formData: FormData) {
  const checkId = Number(formData.get("checkId"));
  if (!checkId) return;
  if (isDemoModeEnabled()) return;

  const supabase = createSupabaseAdminClient();
  const { data: check } = await supabase
    .from("attendance_checks")
    .select("id, worker_id, attendance_rounds!inner(work_date, round_no)")
    .eq("id", checkId)
    .maybeSingle<{
      id: number;
      worker_id: number;
      attendance_rounds: { work_date: string; round_no: number } | { work_date: string; round_no: number }[] | null;
    }>();

  if (!check) return;
  const round = Array.isArray(check.attendance_rounds)
    ? check.attendance_rounds[0]
    : check.attendance_rounds;
  const workDate = round?.work_date ?? null;
  const roundNo = round?.round_no ?? 1;
  if (!workDate) return;

  await submitAttendanceByWorkersEngine({
    items: [{ worker_id: check.worker_id, status: "present" }],
    workDate,
    note: "attendance review round",
    roundNo,
  });
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/approval");
}

export async function returnAttendanceToPreparation(formData: FormData) {
  const checkId = Number(formData.get("checkId"));
  if (!checkId || isDemoModeEnabled()) return;

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("attendance_checks").delete().eq("id", checkId);
  if (error) throw new Error(error.message);

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/approval");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
}

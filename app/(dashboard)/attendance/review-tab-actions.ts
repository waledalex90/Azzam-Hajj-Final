"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { assertWorkerIdsEligibleForPrep } from "@/lib/services/attendance-prep-guard";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export type CancelHalfDayPrepResult = { ok: true } | { ok: false; error: string };

/** حذف سجل حضور معلّق من نوع قديم (قبل تقييد النظام بحاضر/غائب) لإرجاع العامل لقائمة التحضير. */
export async function cancelHalfDayAttendancePrep(formData: FormData): Promise<CancelHalfDayPrepResult> {
  const checkId = Number(formData.get("checkId"));
  if (!checkId || isDemoModeEnabled()) {
    return { ok: false, error: "طلب غير صالح أو وضع العرض." };
  }

  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.EDIT_ATTENDANCE)) {
    return { ok: false, error: "لا تملك صلاحية تعديل سجل الحضور." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: check, error: fetchErr } = await supabase
    .from("attendance_checks")
    .select("id, worker_id, status, confirmation_status")
    .eq("id", checkId)
    .maybeSingle<{
      id: number;
      worker_id: number;
      status: "present" | "absent" | "half";
      confirmation_status: "pending" | "confirmed" | "rejected";
    }>();

  if (fetchErr || !check) {
    return { ok: false, error: fetchErr?.message ?? "السجل غير موجود." };
  }
  if (check.confirmation_status !== "pending") {
    return { ok: false, error: "لا يُلغى إلا سجل بانتظار الاعتماد." };
  }
  if (check.status !== "half") {
    return { ok: false, error: "هذا الإجراء يخصّ سجلات قديمة فقط — راجع الدعم." };
  }

  const prepGuard = await assertWorkerIdsEligibleForPrep(appUser, [check.worker_id]);
  if (!prepGuard.ok) {
    return { ok: false, error: prepGuard.error };
  }

  const { error: delErr } = await supabase.from("attendance_checks").delete().eq("id", checkId);
  if (delErr) {
    return { ok: false, error: delErr.message };
  }

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/approval");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return { ok: true };
}

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

  const { appUser } = await getSessionContext();
  if (
    !appUser ||
    (!hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP) && !hasPermission(appUser, PERM.EDIT_ATTENDANCE))
  ) {
    return;
  }
  const prepGuard = await assertWorkerIdsEligibleForPrep(appUser, [check.worker_id]);
  if (!prepGuard.ok) {
    throw new Error(prepGuard.error);
  }

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

  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.EDIT_ATTENDANCE)) {
    throw new Error("لا تملك صلاحية تعديل سجل الحضور.");
  }

  const supabase = createSupabaseAdminClient();
  const { data: check } = await supabase
    .from("attendance_checks")
    .select("id, worker_id, confirmation_status")
    .eq("id", checkId)
    .maybeSingle<{ id: number; worker_id: number; confirmation_status: string }>();

  if (!check || check.confirmation_status !== "pending") {
    throw new Error("يُسمح بإرجاع السجل للتحضير فقط عندما يكون بانتظار الاعتماد.");
  }

  const prepGuard = await assertWorkerIdsEligibleForPrep(appUser, [check.worker_id]);
  if (!prepGuard.ok) {
    throw new Error(prepGuard.error);
  }

  const { error } = await supabase.from("attendance_checks").delete().eq("id", checkId);
  if (error) throw new Error(error.message);

  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/approval");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
}

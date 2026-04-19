"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { canRequestAttendanceCorrection } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export type ReviewCorrectionResult = { ok: true } | { ok: false; error: string };

export async function submitAttendanceCorrectionRequestFromReview(input: {
  checkId: number;
  reason: string;
  requestedStatus: "present" | "absent" | "half";
}): Promise<ReviewCorrectionResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser: actor } = await getSessionContext();
  if (!actor || !canRequestAttendanceCorrection(actor)) {
    return { ok: false, error: "لا توجد صلاحية لطلب التعديل." };
  }

  const checkId = Number(input.checkId);
  const requestedStatus = input.requestedStatus;
  const reasonBase = String(input.reason || "").trim() || "طلب تعديل حضور — مراجعة تحضير اليوم";
  const statusLabel =
    requestedStatus === "present" ? "حاضر" : requestedStatus === "absent" ? "غائب" : "نصف يوم";
  const reason = `${reasonBase}\n[الحالة المطلوبة: ${statusLabel}]`;

  if (!checkId) return { ok: false, error: "سجل غير صالح." };
  if (!["present", "absent", "half"].includes(requestedStatus)) {
    return { ok: false, error: "حالة غير صالحة." };
  }

  const supabase = createSupabaseAdminClient();
  const insertRes = await supabase.from("correction_requests").insert({
    attendance_id: checkId,
    requester_id: actor.id,
    reason,
    status: "pending",
  });

  if (insertRes.error) {
    await supabase
      .from("attendance_checks")
      .update({ confirm_note: `طلب تعديل حضور: ${reason}` })
      .eq("id", checkId);
  }

  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/corrections");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return { ok: true };
}

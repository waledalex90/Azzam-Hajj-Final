"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isAdminOrHrRole } from "@/lib/auth/transfer-access";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export type CorrectionActionResult = { ok: true } | { ok: false; error: string };

export async function resolveCorrectionRequest(
  requestId: number,
  status: "present" | "absent" | "half",
): Promise<CorrectionActionResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser } = await getSessionContext();
  if (!appUser || (!hasPermission(appUser, PERM.APPROVAL) && !isAdminOrHrRole(appUser.role))) {
    return { ok: false, error: "لا توجد صلاحية لاعتماد طلب التعديل (موارد/أدمن أو من لديه اعتماد)." };
  }
  if (!requestId || !["present", "absent", "half"].includes(status)) {
    return { ok: false, error: "بيانات غير صالحة." };
  }

  const supabase = createSupabaseAdminClient();
  const { data: reqRow, error: reqErr } = await supabase
    .from("correction_requests")
    .select("id, attendance_id, status")
    .eq("id", requestId)
    .maybeSingle<{ id: number; attendance_id: number | null; status: string }>();

  if (reqErr || !reqRow?.attendance_id) {
    return { ok: false, error: "الطلب غير موجود." };
  }
  if (reqRow.status !== "pending") {
    return { ok: false, error: "تمت معالجة هذا الطلب مسبقاً." };
  }

  const checkId = reqRow.attendance_id;

  const statusAr = status === "present" ? "حاضر" : status === "absent" ? "غائب" : "نصف يوم";
  const { error: upCheck } = await supabase
    .from("attendance_checks")
    .update({
      status,
      confirmation_status: "confirmed",
      confirm_note: `اعتماد طلب تعديل — الحالة: ${statusAr}`,
      confirmed_at: new Date().toISOString(),
    })
    .eq("id", checkId);

  if (upCheck) {
    return { ok: false, error: "فشل تحديث سجل الحضور." };
  }

  const { error: upReq } = await supabase
    .from("correction_requests")
    .update({ status: "approved" })
    .eq("id", requestId);

  if (upReq) {
    return { ok: false, error: "تم تحديث الحضور لكن تعذّر إغلاق الطلب." };
  }

  revalidatePath("/corrections");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return { ok: true };
}

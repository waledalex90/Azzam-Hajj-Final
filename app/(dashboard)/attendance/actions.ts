"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { assertWorkerIdsEligibleForPrep } from "@/lib/services/attendance-prep-guard";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { formatPostgrestLikeError } from "@/lib/utils/postgrest-error";

export type PrepActionResult = { ok: true } | { ok: false; error: string };

export async function revalidateAttendancePageCache(): Promise<void> {
  const { appUser } = await getSessionContext();
  if (!appUser) return;
  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
}

type Status = "present" | "absent" | "half";

const CHUNK = 500;

export async function submitAttendancePrepBulk(
  workDate: string,
  status: Status,
  workerIds: number[],
  roundNo: number = 1,
  opts?: { revalidate?: boolean },
): Promise<PrepActionResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.PREP)) {
    return { ok: false, error: "لا توجد صلاحية للتحضير." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { ok: false, error: "تاريخ غير صالح." };
  }
  if (!["present", "absent", "half"].includes(status)) {
    return { ok: false, error: "حالة غير صالحة." };
  }
  const ids = Array.from(new Set(workerIds.map((id) => Number(id)).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "لم يُحدد أي عامل." };
  if (ids.length > CHUNK) {
    return { ok: false, error: `الحد الأقصى ${CHUNK} عاملًا لكل طلب — يُجمع من الواجهة.` };
  }
  const prepGuard = await assertWorkerIdsEligibleForPrep(appUser, ids);
  if (!prepGuard.ok) {
    return { ok: false, error: prepGuard.error };
  }
  try {
    await submitAttendanceByWorkersEngine({
      items: ids.map((worker_id) => ({ worker_id, status })),
      workDate,
      note: "bulk prep server action",
      roundNo: Math.max(1, Math.min(Number(roundNo) || 1, 9)),
    });
    if (opts?.revalidate !== false) {
      revalidatePath("/attendance");
      revalidatePath("/dashboard");
      revalidatePath("/approval");
      revalidateTag("dashboard-stats", "max");
      revalidateTag("dashboard-admin", "max");
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatPostgrestLikeError(e) };
  }
}

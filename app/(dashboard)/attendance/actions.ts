"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export type PrepActionResult = { ok: true } | { ok: false; error: string };

type Status = "present" | "absent" | "half";

const CHUNK = 200;

export async function submitAttendancePrepBulk(
  workDate: string,
  status: Status,
  workerIds: number[],
  roundNo: number = 1,
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
  try {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await submitAttendanceByWorkersEngine({
        items: chunk.map((worker_id) => ({ worker_id, status })),
        workDate,
        note: "bulk prep server action",
        roundNo: Math.max(1, Math.min(Number(roundNo) || 1, 9)),
      });
    }
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/approval");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-admin", "max");
    return { ok: true };
  } catch {
    return { ok: false, error: "فشل الاتصال أو الحفظ." };
  }
}

"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { assertWorkerIdsEligibleForPrep } from "@/lib/services/attendance-prep-guard";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { formatPostgrestLikeError } from "@/lib/utils/postgrest-error";
import { getAttendanceWorkerIdsForFilters } from "@/lib/data/attendance";
import { resolveAllowedSiteIdsForSession } from "@/lib/auth/transfer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { effectivePrepRoundForWorker, type PrepShiftScope } from "@/lib/utils/attendance-shift";

export type PrepActionResult = { ok: true } | { ok: false; error: string };

export async function revalidateAttendancePageCache(): Promise<void> {
  const { appUser } = await getSessionContext();
  if (!appUser) return;
  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
}

type Status = "present" | "absent";

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
  if (!appUser || !hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP)) {
    return { ok: false, error: "لا توجد صلاحية لتسجيل التحضير." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { ok: false, error: "تاريخ غير صالح." };
  }
  if (!["present", "absent"].includes(status)) {
    return { ok: false, error: "الحضور مقتصر على حاضر أو غائب فقط." };
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

/** تحضير كل المعلّقين المطابقين للفلتر دون إرسال آلاف المعرفات من المتصفح. */
export async function submitAttendancePrepMatchingFilters(params: {
  workDate: string;
  status: Status;
  siteId?: number;
  contractorId?: number;
  search?: string;
  prepShiftScope: PrepShiftScope;
  usePerWorkerRound?: boolean;
  roundNo?: number;
}): Promise<PrepActionResult & { count?: number }> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP)) {
    return { ok: false, error: "لا توجد صلاحية لتسجيل التحضير." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(params.workDate)) {
    return { ok: false, error: "تاريخ غير صالح." };
  }
  if (!["present", "absent"].includes(params.status)) {
    return { ok: false, error: "الحضور مقتصر على حاضر أو غائب فقط." };
  }

  const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);
  const ids = await getAttendanceWorkerIdsForFilters({
    siteId: params.siteId,
    allowedSiteIds,
    contractorId: params.contractorId,
    search: params.search,
    workDate: params.workDate,
    prepShiftScope: params.prepShiftScope,
    excludeAlreadyPrepped: true,
  });
  if (ids.length === 0) return { ok: false, error: "لا يوجد معلّقون ضمن الفلتر." };

  const guard = await assertWorkerIdsEligibleForPrep(appUser, ids);
  if (!guard.ok) return { ok: false, error: guard.error };

  const roundById = new Map<number, 1 | 2>();
  if (params.usePerWorkerRound) {
    const supabase = createSupabaseAdminClient();
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      const { data } = await supabase.from("workers").select("id, shift_round").in("id", chunk);
      for (const row of (data ?? []) as Array<{ id: number; shift_round: number | null }>) {
        roundById.set(Number(row.id), effectivePrepRoundForWorker(row.shift_round));
      }
    }
  }

  try {
    const defaultRound = Math.max(1, Math.min(Number(params.roundNo) || 1, 9));
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      if (params.usePerWorkerRound) {
        const r1 = chunk.filter((id) => (roundById.get(id) ?? 1) === 1);
        const r2 = chunk.filter((id) => roundById.get(id) === 2);
        if (r1.length) {
          await submitAttendanceByWorkersEngine({
            items: r1.map((worker_id) => ({ worker_id, status: params.status })),
            workDate: params.workDate,
            note: "bulk prep matching filters",
            roundNo: 1,
          });
        }
        if (r2.length) {
          await submitAttendanceByWorkersEngine({
            items: r2.map((worker_id) => ({ worker_id, status: params.status })),
            workDate: params.workDate,
            note: "bulk prep matching filters",
            roundNo: 2,
          });
        }
      } else {
        await submitAttendanceByWorkersEngine({
          items: chunk.map((worker_id) => ({ worker_id, status: params.status })),
          workDate: params.workDate,
          note: "bulk prep matching filters",
          roundNo: defaultRound,
        });
      }
    }
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/approval");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-admin", "max");
    return { ok: true, count: ids.length };
  } catch (e) {
    return { ok: false, error: formatPostgrestLikeError(e) };
  }
}

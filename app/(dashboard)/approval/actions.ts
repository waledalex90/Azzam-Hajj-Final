"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { getPendingApprovalCheckIds } from "@/lib/data/attendance";
import { applyApprovalDecisionsEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";

const CHUNK = 500;

function revalidateApprovalCaches() {
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidatePath("/attendance");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
}

export type ActionResult = { ok: true } | { ok: false; error: string };

export type FetchPendingIdsResult = { ok: true; ids: number[] } | { ok: false; error: string };

/** دفعة واحدة بحد أقصى 500 — التجميع من الواجهة مع شريط تقدّم (مثل التحضير). */
export async function approveApprovalChunk(checkIds: number[]): Promise<ActionResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.APPROVAL)) {
    return { ok: false, error: "لا توجد صلاحية للاعتماد." };
  }
  const ids = Array.from(new Set(checkIds.map((id) => Number(id)).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "لم يُحدد أي سجل." };
  if (ids.length > CHUNK) {
    return { ok: false, error: `الحد الأقصى ${CHUNK} سجلًا لكل دفعة — يُجمع من الواجهة.` };
  }
  try {
    await applyApprovalDecisionsEngine({ checkIds: ids, decision: "confirm" });
    revalidateApprovalCaches();
    return { ok: true };
  } catch {
    return { ok: false, error: "فشل الحفظ — حاول مرة أخرى." };
  }
}

export async function fetchPendingApprovalIds(input: {
  workDate: string;
  siteId?: number;
  contractorId?: number;
  roundNo: number;
}): Promise<FetchPendingIdsResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.APPROVAL)) {
    return { ok: false, error: "لا توجد صلاحية للاعتماد." };
  }
  const workDate = String(input.workDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { ok: false, error: "تاريخ غير صالح." };
  }
  try {
    const ids = await getPendingApprovalCheckIds({
      workDate,
      siteId: input.siteId,
      contractorId: input.contractorId,
      search: undefined,
      roundNo: input.roundNo,
    });
    return { ok: true, ids };
  } catch {
    return { ok: false, error: "فشل الاتصال." };
  }
}

"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { getPendingApprovalCheckIds } from "@/lib/data/attendance";
import { applyApprovalDecisionsEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";

const CHUNK = 500;

export type ActionResult = { ok: true } | { ok: false; error: string };

export async function approveChecksByIds(checkIds: number[]): Promise<ActionResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "وضع العرض فقط — لا يُحفظ." };
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.APPROVAL)) {
    return { ok: false, error: "لا توجد صلاحية للاعتماد." };
  }
  const ids = Array.from(new Set(checkIds.map((id) => Number(id)).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "لم يُحدد أي سجل." };
  try {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await applyApprovalDecisionsEngine({ checkIds: chunk, decision: "confirm" });
    }
    revalidatePath("/approval");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-admin", "max");
    return { ok: true };
  } catch {
    return { ok: false, error: "فشل الحفظ — حاول مرة أخرى." };
  }
}

export async function approveAllPendingInFilter(input: {
  workDate: string;
  siteId?: number;
  q?: string;
}): Promise<ActionResult> {
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
      search: input.q?.trim() || undefined,
    });
    if (ids.length === 0) return { ok: false, error: "لا توجد سجلات معلّقة ضمن الفلتر." };
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      await applyApprovalDecisionsEngine({ checkIds: chunk, decision: "confirm" });
    }
    revalidatePath("/approval");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-admin", "max");
    return { ok: true };
  } catch {
    return { ok: false, error: "فشل الاتصال أو الحفظ." };
  }
}

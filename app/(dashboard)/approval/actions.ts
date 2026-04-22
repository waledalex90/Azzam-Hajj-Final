"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { resolveAllowedSiteIdsForSession } from "@/lib/auth/transfer-access";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPendingApprovalCheckIds } from "@/lib/data/attendance";
import { applyApprovalDecisionsEngine } from "@/lib/services/attendance-engine";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { formatPostgrestLikeError } from "@/lib/utils/postgrest-error";

const CHUNK = 500;

function revalidateApprovalCaches() {
  revalidatePath("/approval", "layout");
  revalidatePath("/approval", "page");
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
  if (!appUser || !hasPermission(appUser, PERM.APPROVE_ATTENDANCE)) {
    return { ok: false, error: "لا توجد صلاحية للاعتماد." };
  }
  const ids = Array.from(new Set(checkIds.map((id) => Number(id)).filter(Boolean)));
  if (ids.length === 0) return { ok: false, error: "لم يُحدد أي سجل." };
  if (ids.length > CHUNK) {
    return { ok: false, error: `الحد الأقصى ${CHUNK} سجلًا لكل طلب — يُجمع من الواجهة.` };
  }
  const scope = await resolveAllowedSiteIdsForSession(appUser);
  if (scope !== undefined && scope.length > 0) {
    const supabase = createSupabaseAdminClient();
    const { data: rows, error: scopeErr } = await supabase
      .from("attendance_checks")
      .select("id, attendance_rounds!inner(site_id)")
      .in("id", ids);
    if (scopeErr) {
      return { ok: false, error: scopeErr.message || "تعذّر التحقق من نطاق المواقع." };
    }
    const got = rows?.length ?? 0;
    if (got !== ids.length) {
      return { ok: false, error: "بعض السجلات غير موجودة أو خارج نطاقك." };
    }
    for (const r of rows ?? []) {
      const ar = r.attendance_rounds as { site_id: number } | { site_id: number }[] | null;
      const one = Array.isArray(ar) ? ar[0] : ar;
      const sid = one?.site_id;
      if (sid == null || !scope.includes(Number(sid))) {
        return { ok: false, error: "لا يمكن اعتماد سجل خارج المواقع المسموحة لحسابك." };
      }
    }
  }
  try {
    await applyApprovalDecisionsEngine({ checkIds: ids, decision: "confirm" });
    revalidateApprovalCaches();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: formatPostgrestLikeError(e) };
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
  if (!appUser || !hasPermission(appUser, PERM.APPROVE_ATTENDANCE)) {
    return { ok: false, error: "لا توجد صلاحية للاعتماد." };
  }
  const workDate = String(input.workDate || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { ok: false, error: "تاريخ غير صالح." };
  }
  try {
    const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);
    let siteId = input.siteId;
    if (allowedSiteIds !== undefined && allowedSiteIds.length > 0) {
      if (siteId !== undefined && !allowedSiteIds.includes(siteId)) {
        siteId = undefined;
      }
    }
    const ids = await getPendingApprovalCheckIds({
      workDate,
      siteId,
      contractorId: input.contractorId,
      search: undefined,
      roundNo: input.roundNo,
      allowedSiteIds,
    });
    return { ok: true, ids };
  } catch (e) {
    return { ok: false, error: formatPostgrestLikeError(e) };
  }
}

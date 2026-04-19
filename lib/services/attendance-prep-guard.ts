import "server-only";

import { resolveAllowedSiteIdsForSession } from "@/lib/auth/transfer-access";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/types/db";

export type PrepGuardResult = { ok: true } | { ok: false; error: string };

/**
 * يطابق تقريباً فلترة `getAllPendingPrepWorkers` (إدارة) قبل استدعاء RPC الذي يعتمد على JWT + can_access_* في Postgres.
 * يقلّل حالات «لم يُحفظ أي سجل» الصامتة ويعيد سبباً واضحاً عند عدم التطابق.
 */
export async function assertWorkerIdsEligibleForPrep(appUser: AppUser, workerIds: number[]): Promise<PrepGuardResult> {
  const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);
  if (allowedSiteIds !== undefined && allowedSiteIds.length === 0) {
    return {
      ok: false,
      error: "لا توجد مواقع مربوطة بحسابك — أضف المواقع من إعدادات المستخدم ثم أعد المحاولة.",
    };
  }

  const supabase = createSupabaseAdminClient();
  const { data: rows, error } = await supabase
    .from("workers")
    .select("id, current_site_id, is_active, is_deleted")
    .in("id", workerIds);

  if (error) {
    return { ok: false, error: error.message || "تعذّر التحقق من بيانات العمال." };
  }

  const byId = new Map((rows ?? []).map((r) => [Number((r as { id: number }).id), r as PrepWorkerRow]));

  for (const id of workerIds) {
    const row = byId.get(id);
    if (!row) {
      return { ok: false, error: `العامل غير موجود في النظام (المعرّف: ${id}).` };
    }
    if (row.is_deleted) {
      return { ok: false, error: "لا يمكن تحضير عامل محذوف — استرجعه من شاشة العمال إن لزم." };
    }
    if (!row.is_active) {
      return { ok: false, error: "لا يمكن تحضير عامل موقوف — فعّله من شاشة العمال أولاً." };
    }
    const sid = row.current_site_id;
    if (sid == null || !Number.isFinite(Number(sid)) || Number(sid) <= 0) {
      return {
        ok: false,
        error: "عامل بلا «موقع حالي» — افتح شاشة «العمال»، عيّن الموقع، احفظ، ثم أعد التحضير.",
      };
    }
    if (allowedSiteIds !== undefined && allowedSiteIds.length > 0) {
      const n = Number(sid);
      if (!allowedSiteIds.includes(n)) {
        return {
          ok: false,
          error:
            "موقع العامل ليس ضمن المواقع المربوطة بحسابك — راجع حقل المواقع في إدارة المستخدمين (أو جدول ربط المواقع).",
        };
      }
    }
  }

  return { ok: true };
}

type PrepWorkerRow = {
  id: number;
  current_site_id: number | null;
  is_active: boolean;
  is_deleted: boolean;
};

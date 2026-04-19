import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/types/db";
import { ROLES } from "@/lib/constants/roles";

export function isAdminOrHrRole(role: string): boolean {
  return role === ROLES.admin || role === "hr";
}

export function isTechnicalObserver(role: string): boolean {
  return role === ROLES.technicalObserver;
}

export function isFieldObserver(role: string): boolean {
  return role === ROLES.fieldObserver;
}

/** مواقع المستخدم من app_user_sites — فارغ يعني لا مواقع مربوطة (المراقب الميداني يحتاج صفوف). */
export async function getAppUserSiteIds(appUserId: number): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("app_user_sites")
    .select("site_id")
    .eq("app_user_id", appUserId);
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01") return [];
    return [];
  }
  if (!data) return [];
  return (data as Array<{ site_id: number }>).map((r) => r.site_id).filter(Boolean);
}

/**
 * مواقع المستخدم: أولاً من `app_users.allowed_site_ids` (واجهة إدارة المستخدمين)،
 * وإلا من جدول `app_user_sites` إن وُجد.
 */
export async function getEffectiveSiteIdsForAppUser(appUser: AppUser): Promise<number[]> {
  if (appUser.allowedSiteIds === undefined) {
    return getAppUserSiteIds(appUser.id);
  }
  const fromColumn = appUser.allowedSiteIds.filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set(fromColumn)].sort((a, b) => a - b);
}

/**
 * أدوار يُعامل «بدون مواقع في الإدارة» كـ **كل المواقع** (لا تقييد).
 * باقي الأدوار: بدون مواقع محددة = لا يرى أي موقع (مصفوفة فارغة).
 */
export function isSiteRestrictionExemptRole(role: string): boolean {
  return role === ROLES.admin || role === ROLES.hr || role === ROLES.technicalObserver;
}

/**
 * نطاق المواقع للواجهات والاستعلامات:
 * - `undefined` = غير مقيّد (كل المواقع) — إدارة / فني / موارد عادةً.
 * - `[]` = مقيّد لكن لا يوجد موقع مسموح (لا بيانات).
 * - `[…ids]` = هذه المواقع فقط.
 */
export async function resolveAllowedSiteIdsForSession(appUser: AppUser): Promise<number[] | undefined> {
  const raw = await getEffectiveSiteIdsForAppUser(appUser);
  if (raw.length > 0) return raw;
  if (isSiteRestrictionExemptRole(appUser.role)) return undefined;
  return [];
}

export function canCreateWorkerTransferRequest(
  appUser: AppUser,
  fromSiteId: number | null,
  userSiteIds: number[],
): boolean {
  if (isAdminOrHrRole(appUser.role) || isTechnicalObserver(appUser.role)) return true;
  if (!isFieldObserver(appUser.role)) return false;
  if (fromSiteId == null) return false;
  return userSiteIds.includes(fromSiteId);
}

export function canRespondAsDestinationSite(
  appUser: AppUser,
  toSiteId: number,
  userSiteIds: number[],
): boolean {
  if (isAdminOrHrRole(appUser.role) || isTechnicalObserver(appUser.role)) return true;
  if (!isFieldObserver(appUser.role)) return false;
  return userSiteIds.includes(toSiteId);
}

export function canRespondAsHr(appUser: AppUser): boolean {
  return isAdminOrHrRole(appUser.role);
}

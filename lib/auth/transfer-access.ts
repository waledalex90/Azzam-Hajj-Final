import "server-only";

import { hasPermission, hasWildcardPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PERM } from "@/lib/permissions/keys";
import type { AppUser } from "@/lib/types/db";

/** @deprecated use hasPermission(appUser, …) */
export function isAdminOrHrRole(_role: string): boolean {
  void _role;
  return false;
}

/** يرى كل المواقع دون اقتصار على app_user_sites (من مفاتيح الدور فقط). */
export function isSiteRestrictionExemptByPermissions(appUser: AppUser | null | undefined): boolean {
  if (!appUser) return false;
  return (
    hasWildcardPermission(appUser) ||
    hasPermission(appUser, PERM.ACCESS_ALL_SITES) ||
    hasPermission(appUser, PERM.MANAGE_USERS) ||
    hasPermission(appUser, PERM.MANAGE_ROLES)
  );
}

/** @deprecated use isSiteRestrictionExemptByPermissions(appUser) */
export function isSiteRestrictionExemptRole(_role: string): boolean {
  void _role;
  return false;
}

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

async function getLegacyUserSitesIds(appUserId: number): Promise<number[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("user_sites")
    .select("site_id")
    .eq("user_id", appUserId);
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01") return [];
    return [];
  }
  if (!data) return [];
  return (data as Array<{ site_id: number }>).map((r) => r.site_id).filter(Boolean);
}

/**
 * مواقع المستخدم — يجب أن يطابق اتحاد Postgres في app.current_user_site_ids()
 */
export async function getEffectiveSiteIdsForAppUser(appUser: AppUser): Promise<number[]> {
  const [fromJoin, fromLegacy] = await Promise.all([
    getAppUserSiteIds(appUser.id),
    getLegacyUserSitesIds(appUser.id),
  ]);
  const fromTables = [...new Set([...fromJoin, ...fromLegacy])];
  if (appUser.allowedSiteIds === undefined) {
    return [...fromTables].sort((a, b) => a - b);
  }
  const fromColumn = appUser.allowedSiteIds.filter((id) => Number.isFinite(id) && id > 0);
  return [...new Set([...fromColumn, ...fromTables])].sort((a, b) => a - b);
}

/**
 * نطاق المواقع للواجهات: undefined = غير مقيّد (كل المواقع) حسب مفاتيح الدور والصفوف.
 */
export async function resolveAllowedSiteIdsForSession(appUser: AppUser): Promise<number[] | undefined> {
  const raw = await getEffectiveSiteIdsForAppUser(appUser);
  if (raw.length > 0) return raw;
  if (isSiteRestrictionExemptByPermissions(appUser)) return undefined;
  if (
    appUser.allowedSiteIds !== undefined &&
    appUser.allowedSiteIds.length === 0 &&
    !hasPermission(appUser, PERM.ATTENDANCE_REGISTER_AS_FIELD)
  ) {
    return undefined;
  }
  return [];
}

export function canCreateWorkerTransferRequest(
  appUser: AppUser,
  fromSiteId: number | null,
  userSiteIds: number[],
): boolean {
  if (
    hasPermission(appUser, PERM.MANAGE_TRANSFERS) ||
    hasWildcardPermission(appUser) ||
    hasPermission(appUser, PERM.ACCESS_ALL_SITES) ||
    hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP) ||
    hasPermission(appUser, PERM.EDIT_ATTENDANCE)
  ) {
    return true;
  }
  if (!hasPermission(appUser, PERM.ATTENDANCE_REGISTER_AS_FIELD)) return false;
  if (fromSiteId == null) return false;
  return userSiteIds.includes(fromSiteId);
}

export function canRespondAsDestinationSite(
  appUser: AppUser,
  toSiteId: number,
  userSiteIds: number[],
): boolean {
  if (
    hasPermission(appUser, PERM.MANAGE_TRANSFERS) ||
    hasWildcardPermission(appUser) ||
    hasPermission(appUser, PERM.ACCESS_ALL_SITES) ||
    hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP) ||
    hasPermission(appUser, PERM.EDIT_ATTENDANCE)
  ) {
    return true;
  }
  if (!hasPermission(appUser, PERM.ATTENDANCE_REGISTER_AS_FIELD)) return false;
  return userSiteIds.includes(toSiteId);
}

/** الرد بصفة «الموارد» على طلبات النقل النهائية. */
export function canRespondAsHr(appUser: AppUser): boolean {
  return (
    hasWildcardPermission(appUser) ||
    hasPermission(appUser, PERM.MANAGE_USERS) ||
    (hasPermission(appUser, PERM.MANAGE_TRANSFERS) && hasPermission(appUser, PERM.ACCESS_ALL_SITES))
  );
}

/** عرض كل مواقع الوجهة في نقل الموظفين (قائمة المصفّيات). */
export function canSeeAllDestinationSitesForTransfers(appUser: AppUser): boolean {
  return (
    hasWildcardPermission(appUser) ||
    hasPermission(appUser, PERM.ACCESS_ALL_SITES) ||
    hasPermission(appUser, PERM.MANAGE_USERS) ||
    hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP) ||
    hasPermission(appUser, PERM.EDIT_ATTENDANCE)
  );
}

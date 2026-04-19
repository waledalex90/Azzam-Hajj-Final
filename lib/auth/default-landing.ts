import type { AppUser } from "@/lib/types/db";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";

/** ترتيب يطابق الشريط الجانبي — أول شاشة مسموحة بعد تسجيل الدخول */
const LANDING_ORDER: Array<{ path: string; perm: string }> = [
  { path: "/dashboard", perm: PERM.DASHBOARD },
  { path: "/workers", perm: PERM.WORKERS },
  { path: "/sites", perm: PERM.SITES },
  { path: "/contractors", perm: PERM.CONTRACTORS },
  { path: "/attendance", perm: PERM.PREP },
  { path: "/approval", perm: PERM.APPROVAL },
  { path: "/transfers", perm: PERM.TRANSFERS },
  { path: "/reports", perm: PERM.REPORTS },
  { path: "/corrections", perm: PERM.CORRECTIONS_SCREEN },
  { path: "/violations/notice", perm: PERM.VIOLATION_NOTICE },
  { path: "/violations", perm: PERM.VIOLATIONS },
  { path: "/users", perm: PERM.USERS_MANAGE },
];

/**
 * أول مسار مسموح للمستخدم. إن لم توجد أي صلاحية شاشة — الرئيسية كملاذ أخير (لا يُفضّل).
 */
export function getDefaultLandingPath(appUser: AppUser): string {
  for (const { path, perm } of LANDING_ORDER) {
    if (hasPermission(appUser, perm)) return path;
  }
  if (hasPermission(appUser, PERM.ROLES_MANAGE)) return "/users?tab=roles";
  return "/dashboard";
}

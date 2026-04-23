import type { AppUser } from "@/lib/types/db";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import { ALL_REPORT_TAB_PERMISSIONS, PERM } from "@/lib/permissions/keys";

/** ترتيب يطابق الشريط الجانبي — أول شاشة مسموحة بعد تسجيل الدخول */
const LANDING_ORDER: Array<{ path: string; anyOf: string[] }> = [
  { path: "/dashboard", anyOf: [PERM.VIEW_DASHBOARD] },
  { path: "/workers", anyOf: [PERM.VIEW_WORKERS] },
  { path: "/sites", anyOf: [PERM.VIEW_SITES] },
  { path: "/contractors", anyOf: [PERM.VIEW_CONTRACTORS] },
  { path: "/attendance", anyOf: [PERM.VIEW_ATTENDANCE, PERM.EDIT_ATTENDANCE] },
  { path: "/approval", anyOf: [PERM.APPROVE_ATTENDANCE] },
  { path: "/transfers", anyOf: [PERM.VIEW_TRANSFERS, PERM.MANAGE_TRANSFERS] },
  { path: "/reports", anyOf: [PERM.VIEW_REPORTS, ...ALL_REPORT_TAB_PERMISSIONS] },
  { path: "/corrections", anyOf: [PERM.VIEW_CORRECTIONS_QUEUE, PERM.PROCESS_CORRECTIONS] },
  { path: "/violations/notice", anyOf: [PERM.CREATE_VIOLATION_NOTICE] },
  { path: "/violations", anyOf: [PERM.VIEW_VIOLATIONS, PERM.MANAGE_VIOLATIONS] },
  { path: "/users", anyOf: [PERM.MANAGE_USERS, PERM.MANAGE_ROLES] },
];

/**
 * أول مسار مسموح للمستخدم. إن لم توجد أي صلاحية شاشة — الرئيسية كملاذ أخير (لا يُفضّل).
 */
export function getDefaultLandingPath(appUser: AppUser): string {
  for (const { path, anyOf } of LANDING_ORDER) {
    if (hasAnyPermission(appUser, anyOf)) return path;
  }
  if (hasPermission(appUser, PERM.MANAGE_ROLES)) return "/users?tab=roles";
  return "/dashboard";
}

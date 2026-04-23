import "server-only";

import type { ReportsTab } from "@/app/(dashboard)/reports/actions";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import { ALL_REPORT_TAB_PERMISSIONS, PERM } from "@/lib/permissions/keys";
import type { AppUser } from "@/lib/types/db";

const TAB_TO_PERM: Record<ReportsTab, string> = {
  attendance_log: PERM.REPORT_ATTENDANCE_LOG,
  matrix: PERM.REPORT_MATRIX,
  horizontal_report: PERM.REPORT_HORIZONTAL,
  payroll: PERM.REPORT_PAYROLL,
  contractors: PERM.REPORT_CONTRACTORS,
  violations: PERM.REPORT_VIOLATIONS,
  workers: PERM.REPORT_WORKERS,
};

/** دخول شاشة التقارير: وصول عام أو أي تبويب تقرير. */
export function canAccessReportsApp(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return hasAnyPermission(user, [PERM.VIEW_REPORTS, ...ALL_REPORT_TAB_PERMISSIONS]);
}

export function canViewReportTab(user: AppUser | null | undefined, tab: ReportsTab): boolean {
  if (!user) return false;
  return hasPermission(user, TAB_TO_PERM[tab]);
}

export function canExportReportTab(user: AppUser | null | undefined, tab: ReportsTab): boolean {
  if (!user) return false;
  return hasPermission(user, PERM.EXPORT_REPORTS) && hasPermission(user, TAB_TO_PERM[tab]);
}

export function canExportExportQueryReport(
  user: AppUser | null | undefined,
  report: string,
): boolean {
  const tab = EXPORT_QUERY_TO_TAB[report];
  if (!tab) return false;
  return canExportReportTab(user, tab);
}

const EXPORT_QUERY_TO_TAB: Record<string, ReportsTab> = {
  attendance_log: "attendance_log",
  matrix: "matrix",
  horizontal_report: "horizontal_report",
  payroll: "payroll",
  contractors: "contractors",
  violations: "violations",
  workers: "workers",
};

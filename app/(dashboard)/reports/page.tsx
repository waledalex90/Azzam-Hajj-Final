import type { ReportsTab } from "@/app/(dashboard)/reports/actions";
import { ReportsHubLazy } from "@/components/reports/reports-hub-lazy";
import { canExportReportTab, canViewReportTab } from "@/lib/auth/report-permissions";
import { requireReportsAccess } from "@/lib/auth/require-screen";

const TABS: ReportsTab[] = [
  "attendance_log",
  "matrix",
  "horizontal_report",
  "payroll",
  "contractors",
  "violations",
  "workers",
];

export default async function ReportsPage() {
  const appUser = await requireReportsAccess();
  const canViewTab: Record<ReportsTab, boolean> = {
    attendance_log: canViewReportTab(appUser, "attendance_log"),
    matrix: canViewReportTab(appUser, "matrix"),
    horizontal_report: canViewReportTab(appUser, "horizontal_report"),
    payroll: canViewReportTab(appUser, "payroll"),
    contractors: canViewReportTab(appUser, "contractors"),
    violations: canViewReportTab(appUser, "violations"),
    workers: canViewReportTab(appUser, "workers"),
  };
  const canExportTab: Record<ReportsTab, boolean> = {
    attendance_log: canExportReportTab(appUser, "attendance_log"),
    matrix: canExportReportTab(appUser, "matrix"),
    horizontal_report: canExportReportTab(appUser, "horizontal_report"),
    payroll: canExportReportTab(appUser, "payroll"),
    contractors: canExportReportTab(appUser, "contractors"),
    violations: canExportReportTab(appUser, "violations"),
    workers: canExportReportTab(appUser, "workers"),
  };
  const defaultTab = TABS.find((t) => canViewTab[t]) ?? "attendance_log";
  return (
    <section className="space-y-4">
      <ReportsHubLazy canViewTab={canViewTab} canExportTab={canExportTab} defaultTab={defaultTab} />
    </section>
  );
}

"use server";

import { canAccessReportsApp, canViewReportTab } from "@/lib/auth/report-permissions";
import { getSessionContext } from "@/lib/auth/session";
import {
  fetchContractorInvoiceViolationLines,
  listReportsFilterOptions,
  previewAttendanceLog,
  previewContractors,
  previewMatrix,
  previewPayroll,
  previewViolations,
  previewWorkers,
  rpcSearchEntities,
  type ReportFilters,
} from "@/lib/reports/queries";

export type ReportsTab =
  | "attendance_log"
  | "matrix"
  | "horizontal_report"
  | "payroll"
  | "contractors"
  | "violations"
  | "workers"
  /** معرّفات داخلية (عامل DB id) — مدير النظام فقط */
  | "internal_ids";

export async function searchReportEntitiesAction(
  kind: "site" | "contractor" | "supervisor",
  q: string,
) {
  const { appUser } = await getSessionContext();
  if (!appUser || !canAccessReportsApp(appUser)) return [];
  return rpcSearchEntities(kind, q);
}

export async function listReportsFilterOptionsAction() {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canAccessReportsApp(appUser)) throw new Error("غير مصرح");
  return listReportsFilterOptions();
}

export async function getContractorInvoiceViolationLinesAction(f: ReportFilters) {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canViewReportTab(appUser, "contractors")) throw new Error("غير مصرح");
  return fetchContractorInvoiceViolationLines(f);
}

export async function runReportsPreviewAction(payload: {
  tab: ReportsTab;
  page: number;
  filters: ReportFilters;
  year?: number;
  month?: number;
  attendanceStatus?: string | null;
  violationStatus?: string | null;
  workerStatus?: string;
  workerQ?: string;
  /** بحث مسير الرواتب (اسم / إقامة / كود موظف) — يُطبَّق على السيرفر على كل السجلات */
  payrollSearch?: string | null;
}) {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    throw new Error("غير مصرح");
  }
  if (!canViewReportTab(appUser, payload.tab)) {
    throw new Error("لا صلاحية لهذا التقرير");
  }

  const { tab, page, filters } = payload;

  switch (tab) {
    case "attendance_log":
      return previewAttendanceLog(filters, page, payload.attendanceStatus ?? null);
    case "matrix":
    case "horizontal_report": {
      const y = payload.year ?? new Date().getFullYear();
      const m = payload.month ?? new Date().getMonth() + 1;
      return previewMatrix(y, m, filters, page);
    }
    case "payroll":
      return previewPayroll(filters, page, payload.payrollSearch ?? null);
    case "contractors":
      return previewContractors(filters, page);
    case "violations":
      return previewViolations(filters, page, payload.violationStatus ?? null);
    case "workers":
    case "internal_ids":
      return previewWorkers(
        {
          ...filters,
          workerStatus: payload.workerStatus ?? "all",
          q: payload.workerQ ?? "",
        },
        page,
      );
    default:
      throw new Error("تقرير غير معروف");
  }
}

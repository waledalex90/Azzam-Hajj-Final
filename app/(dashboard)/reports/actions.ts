"use server";

import { getSessionContext } from "@/lib/auth/session";
import {
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
  | "payroll"
  | "contractors"
  | "violations"
  | "workers";

export async function searchReportEntitiesAction(
  kind: "site" | "contractor" | "supervisor",
  q: string,
) {
  const { appUser } = await getSessionContext();
  if (!appUser) return [];
  return rpcSearchEntities(kind, q);
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
}) {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    throw new Error("غير مصرح");
  }

  const { tab, page, filters } = payload;

  switch (tab) {
    case "attendance_log":
      return previewAttendanceLog(filters, page, payload.attendanceStatus ?? null);
    case "matrix": {
      const y = payload.year ?? new Date().getFullYear();
      const m = payload.month ?? new Date().getMonth() + 1;
      return previewMatrix(y, m, filters, page);
    }
    case "payroll":
      return previewPayroll(filters, page);
    case "contractors":
      return previewContractors(filters, page);
    case "violations":
      return previewViolations(filters, page, payload.violationStatus ?? null);
    case "workers":
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

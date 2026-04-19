import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PaginationMeta } from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";

export type ReportFilters = {
  dateFrom: string;
  dateTo: string;
  siteIds: number[] | null;
  contractorIds: number[] | null;
  supervisorIds: number[] | null;
  shiftRound: number | null;
};

const PREVIEW_SIZE = 50;
/** معاينة مسير الرواتب: صفوف أكثر لتسهيل البحث المحلي عن الموظف */
const PREVIEW_PAYROLL_SIZE = 1000;
/**
 * عدد الصفوف في **طلب RPC واحد** (دفعة). التصدير الكامل يكرر الطلبات page=1,2,3… حتى تنفد البيانات —
 * لا يوجد حد أصلي 1000 على إجمالي الملف (قد يصل لملايين الصفوف ما دامت الحلقة تعمل).
 * القيمة ≤ `max_rows` الافتراضي لـ PostgREST في Supabase (غالباً 1000) حتى لا تُقطع الدفعة صامتاً.
 */
const EXPORT_CHUNK = 1000;
/** يطابق `least(p_page_size, N)` في SQL؛ يُستخدم مع EXPORT_CHUNK في شرط إنهاء التصفح. */
export const REPORT_RPC_PAGE_CAP = 1000;

export type EntitySearchRow = { id: number; name: string; subtitle: string };

export async function listReportsFilterOptions(): Promise<{
  sites: { id: number; name: string }[];
  contractors: { id: number; name: string }[];
}> {
  const supabase = createSupabaseAdminClient();
  const [sites, contractors] = await Promise.all([
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("contractors").select("id, name").order("name"),
  ]);
  if (sites.error) throw new Error(sites.error.message);
  if (contractors.error) throw new Error(contractors.error.message);
  return {
    sites: (sites.data ?? []) as { id: number; name: string }[],
    contractors: (contractors.data ?? []) as { id: number; name: string }[],
  };
}

export async function rpcSearchEntities(
  kind: "site" | "contractor" | "supervisor",
  q: string,
): Promise<EntitySearchRow[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("search_report_entities", {
    p_kind: kind,
    p_query: q,
    p_limit: 50,
  });
  if (error) throw new Error(error.message);
  return (data ?? []) as EntitySearchRow[];
}

export async function previewAttendanceLog(
  f: ReportFilters,
  page: number,
  statusFilter: string | null,
): Promise<{ rows: Record<string, unknown>[]; meta: PaginationMeta }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_attendance_log_report_page", {
    p_date_start: f.dateFrom,
    p_date_end: f.dateTo,
    p_site_ids: f.siteIds,
    p_contractor_ids: f.contractorIds,
    p_supervisor_ids: f.supervisorIds,
    p_status: statusFilter && statusFilter !== "all" ? statusFilter : null,
    p_page: page,
    p_page_size: PREVIEW_SIZE,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return { rows, meta: buildPaginationMeta(total, page, PREVIEW_SIZE) };
}

export async function previewMatrix(
  year: number,
  month: number,
  f: ReportFilters,
  page: number,
): Promise<{ rows: Record<string, unknown>[]; meta: PaginationMeta }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_monthly_attendance_matrix_page_v2", {
    p_year: year,
    p_month: month,
    p_site_ids: f.siteIds,
    p_contractor_ids: f.contractorIds,
    p_supervisor_ids: f.supervisorIds,
    p_shift_round: f.shiftRound,
    p_page: page,
    p_page_size: PREVIEW_SIZE,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_workers) : 0;
  return { rows, meta: buildPaginationMeta(total, page, PREVIEW_SIZE) };
}

export async function isPayrollScopeLockedRpc(f: ReportFilters): Promise<boolean> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("is_payroll_scope_locked", {
    p_period_start: f.dateFrom,
    p_period_end: f.dateTo,
    p_site_ids: f.siteIds ?? [],
    p_contractor_ids: f.contractorIds ?? [],
    p_supervisor_ids: f.supervisorIds ?? [],
  });
  if (error) throw new Error(error.message);
  return Boolean(data);
}

export async function upsertPayrollManualDeduction(
  workerId: number,
  periodStart: string,
  periodEnd: string,
  amountSar: number,
  filter: Pick<ReportFilters, "siteIds" | "contractorIds" | "supervisorIds">,
) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("upsert_payroll_manual_deduction", {
    p_worker_id: workerId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_amount_sar: amountSar,
    p_filter_site_ids: filter.siteIds ?? [],
    p_filter_contractor_ids: filter.contractorIds ?? [],
    p_filter_supervisor_ids: filter.supervisorIds ?? [],
  });
  if (error) {
    if (error.message.includes("PAYROLL_LOCKED")) {
      throw new Error("تم اعتماد المسير لهذه الفترة والفلاتر ولا يمكن تعديل الخصومات.");
    }
    throw new Error(error.message);
  }
}

export async function approvePayrollPeriodRpc(f: ReportFilters, createdBy: number) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("approve_payroll_period", {
    p_period_start: f.dateFrom,
    p_period_end: f.dateTo,
    p_site_ids: f.siteIds ?? [],
    p_contractor_ids: f.contractorIds ?? [],
    p_supervisor_ids: f.supervisorIds ?? [],
    p_created_by: createdBy,
  });
  if (error) throw new Error(error.message);
}

export async function unlockPayrollPeriodRpc(f: ReportFilters) {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.rpc("unlock_payroll_period", {
    p_period_start: f.dateFrom,
    p_period_end: f.dateTo,
    p_site_ids: f.siteIds ?? [],
    p_contractor_ids: f.contractorIds ?? [],
    p_supervisor_ids: f.supervisorIds ?? [],
  });
  if (error) throw new Error(error.message);
}

export async function previewPayroll(f: ReportFilters, page: number, search: string | null = null) {
  const supabase = createSupabaseAdminClient();
  const trimmed = search?.trim();
  const { data, error } = await supabase.rpc("get_payroll_report_page_v2", {
    p_date_start: f.dateFrom,
    p_date_end: f.dateTo,
    p_site_ids: f.siteIds,
    p_contractor_ids: f.contractorIds,
    p_supervisor_ids: f.supervisorIds,
    p_shift_round: f.shiftRound,
    p_page: page,
    p_page_size: PREVIEW_PAYROLL_SIZE,
    p_search: trimmed ? trimmed : null,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return { rows, meta: buildPaginationMeta(total, page, PREVIEW_PAYROLL_SIZE) };
}

export async function previewContractors(f: ReportFilters, page: number) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_contractor_invoice_summary_page", {
    p_date_start: f.dateFrom,
    p_date_end: f.dateTo,
    p_site_ids: f.siteIds,
    p_contractor_ids: f.contractorIds,
    p_supervisor_ids: f.supervisorIds,
    p_shift_round: f.shiftRound,
    p_page: page,
    p_page_size: PREVIEW_SIZE,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return { rows, meta: buildPaginationMeta(total, page, PREVIEW_SIZE) };
}

export async function previewViolations(
  f: ReportFilters,
  page: number,
  status: string | null,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_violations_report_page_v2", {
    p_date_from: f.dateFrom,
    p_date_to: f.dateTo,
    p_site_ids: f.siteIds,
    p_contractor_ids: f.contractorIds,
    p_supervisor_ids: f.supervisorIds,
    p_status: status && status !== "all" ? status : null,
    p_shift_round: f.shiftRound,
    p_page: page,
    p_page_size: PREVIEW_SIZE,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return { rows, meta: buildPaginationMeta(total, page, PREVIEW_SIZE) };
}

export async function previewWorkers(
  f: ReportFilters & { workerStatus: string; q: string },
  page: number,
) {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_workers_master_report_page", {
    p_site_ids: f.siteIds,
    p_contractor_ids: f.contractorIds,
    p_supervisor_ids: f.supervisorIds,
    p_status: f.workerStatus === "all" ? null : f.workerStatus,
    p_q: f.q?.trim() || null,
    p_page: page,
    p_page_size: PREVIEW_SIZE,
  });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Record<string, unknown>[];
  const total = rows[0] ? Number(rows[0].total_count) : 0;
  return { rows, meta: buildPaginationMeta(total, page, PREVIEW_SIZE) };
}

/** Total rows for export progress (one cheap paged call). */
export async function estimateExportTotal(
  report: string,
  f: ReportFilters,
  extra: { year?: number; month?: number; attendanceStatus?: string | null; violationStatus?: string | null; workerStatus?: string; workerQ?: string },
): Promise<number> {
  const supabase = createSupabaseAdminClient();
  switch (report) {
    case "attendance_log": {
      const { data, error } = await supabase.rpc("get_attendance_log_report_page", {
        p_date_start: f.dateFrom,
        p_date_end: f.dateTo,
        p_site_ids: f.siteIds,
        p_contractor_ids: f.contractorIds,
        p_supervisor_ids: f.supervisorIds,
        p_status:
          extra.attendanceStatus && extra.attendanceStatus !== "all"
            ? extra.attendanceStatus
            : null,
        p_page: 1,
        p_page_size: 1,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? []) as { total_count?: number }[];
      return r[0] ? Number(r[0].total_count) : 0;
    }
    case "matrix":
    case "horizontal_report": {
      const { data, error } = await supabase.rpc("get_monthly_attendance_matrix_page_v2", {
        p_year: extra.year!,
        p_month: extra.month!,
        p_site_ids: f.siteIds,
        p_contractor_ids: f.contractorIds,
        p_supervisor_ids: f.supervisorIds,
        p_shift_round: f.shiftRound,
        p_page: 1,
        p_page_size: 1,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? []) as { total_workers?: number }[];
      return r[0] ? Number(r[0].total_workers) : 0;
    }
    case "payroll": {
      const { data, error } = await supabase.rpc("get_payroll_report_page_v2", {
        p_date_start: f.dateFrom,
        p_date_end: f.dateTo,
        p_site_ids: f.siteIds,
        p_contractor_ids: f.contractorIds,
        p_supervisor_ids: f.supervisorIds,
        p_shift_round: f.shiftRound,
        p_page: 1,
        p_page_size: 1,
        p_search: null,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? []) as { total_count?: number }[];
      return r[0] ? Number(r[0].total_count) : 0;
    }
    case "contractors": {
      const { data, error } = await supabase.rpc("get_contractor_invoice_summary_page", {
        p_date_start: f.dateFrom,
        p_date_end: f.dateTo,
        p_site_ids: f.siteIds,
        p_contractor_ids: f.contractorIds,
        p_supervisor_ids: f.supervisorIds,
        p_shift_round: f.shiftRound,
        p_page: 1,
        p_page_size: 1,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? []) as { total_count?: number }[];
      return r[0] ? Number(r[0].total_count) : 0;
    }
    case "violations": {
      const { data, error } = await supabase.rpc("get_violations_report_page_v2", {
        p_date_from: f.dateFrom,
        p_date_to: f.dateTo,
        p_site_ids: f.siteIds,
        p_contractor_ids: f.contractorIds,
        p_supervisor_ids: f.supervisorIds,
        p_status:
          extra.violationStatus && extra.violationStatus !== "all"
            ? extra.violationStatus
            : null,
        p_shift_round: f.shiftRound,
        p_page: 1,
        p_page_size: 1,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? []) as { total_count?: number }[];
      return r[0] ? Number(r[0].total_count) : 0;
    }
    case "workers": {
      const { data, error } = await supabase.rpc("get_workers_master_report_page", {
        p_site_ids: f.siteIds,
        p_contractor_ids: f.contractorIds,
        p_supervisor_ids: f.supervisorIds,
        p_status: extra.workerStatus === "all" ? null : extra.workerStatus ?? null,
        p_q: extra.workerQ?.trim() || null,
        p_page: 1,
        p_page_size: 1,
      });
      if (error) throw new Error(error.message);
      const r = (data ?? []) as { total_count?: number }[];
      return r[0] ? Number(r[0].total_count) : 0;
    }
    default:
      return 0;
  }
}

export { EXPORT_CHUNK, PREVIEW_SIZE };

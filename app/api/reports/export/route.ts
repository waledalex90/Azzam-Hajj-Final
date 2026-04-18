import { NextRequest } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CSV_UTF8_BOM, rowToCsvLine } from "@/lib/reports/csv";
import { parseIdList } from "@/lib/reports/filters";
import { EXPORT_CHUNK } from "@/lib/reports/queries";
import type { ReportFilters } from "@/lib/reports/queries";

function filtersFromUrl(url: URL): ReportFilters {
  return {
    dateFrom: url.searchParams.get("dateFrom") || "",
    dateTo: url.searchParams.get("dateTo") || "",
    siteIds: parseIdList(url.searchParams.get("sites")),
    contractorIds: parseIdList(url.searchParams.get("contractors")),
    supervisorIds: parseIdList(url.searchParams.get("supervisors")),
    shiftRound: (() => {
      const s = url.searchParams.get("shiftRound");
      if (s === "1") return 1;
      if (s === "2") return 2;
      return null;
    })(),
  };
}

export async function GET(req: NextRequest) {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    return new Response("Unauthorized", { status: 401 });
  }

  const url = req.nextUrl;
  const report = url.searchParams.get("report");
  if (!report) {
    return new Response("Missing report", { status: 400 });
  }

  const f = filtersFromUrl(url);
  const skipsDateRange = report === "workers" || report === "matrix" || report === "horizontal_report";
  if (!skipsDateRange && (!f.dateFrom || !f.dateTo)) {
    return new Response("dateFrom/dateTo required", { status: 400 });
  }

  const year = url.searchParams.get("year") ? Number(url.searchParams.get("year")) : null;
  const month = url.searchParams.get("month") ? Number(url.searchParams.get("month")) : null;
  if ((report === "matrix" || report === "horizontal_report") && (!year || !month)) {
    return new Response("year/month required for matrix-style reports", { status: 400 });
  }

  const attendanceStatus = url.searchParams.get("attendanceStatus");
  const violationStatus = url.searchParams.get("violationStatus");
  const workerStatus = url.searchParams.get("workerStatus") ?? "all";
  const workerQ = url.searchParams.get("workerQ") ?? "";

  const enc = new TextEncoder();
  const supabase = createSupabaseAdminClient();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(enc.encode(CSV_UTF8_BOM));

        let headerWritten = false;

        const ensureHeader = (headers: string[]) => {
          if (!headerWritten) {
            controller.enqueue(enc.encode(rowToCsvLine(headers) + "\n"));
            headerWritten = true;
          }
        };

        let page = 1;
        // eslint-disable-next-line no-constant-condition
        while (true) {
          let rows: Record<string, unknown>[] = [];

          switch (report) {
            case "attendance_log": {
              const { data, error } = await supabase.rpc("get_attendance_log_report_page", {
                p_date_start: f.dateFrom,
                p_date_end: f.dateTo,
                p_site_ids: f.siteIds,
                p_contractor_ids: f.contractorIds,
                p_supervisor_ids: f.supervisorIds,
                p_status:
                  attendanceStatus && attendanceStatus !== "all" ? attendanceStatus : null,
                p_page: page,
                p_page_size: EXPORT_CHUNK,
              });
              if (error) throw new Error(error.message);
              rows = (data ?? []) as Record<string, unknown>[];
              ensureHeader([
                "worker_id",
                "work_date",
                "worker_name",
                "id_number",
                "site_name",
                "contractor_name",
                "supervisor_name",
                "final_status",
              ]);
              for (const r of rows) {
                controller.enqueue(
                  enc.encode(
                    rowToCsvLine([
                      r.worker_id,
                      r.work_date,
                      r.worker_name,
                      r.id_number,
                      r.site_name,
                      r.contractor_name,
                      r.supervisor_name,
                      r.final_status,
                    ]) + "\n",
                  ),
                );
              }
              break;
            }
            case "matrix":
            case "horizontal_report": {
              const { data, error } = await supabase.rpc("get_monthly_attendance_matrix_page_v2", {
                p_year: year!,
                p_month: month!,
                p_site_ids: f.siteIds,
                p_contractor_ids: f.contractorIds,
                p_supervisor_ids: f.supervisorIds,
                p_shift_round: f.shiftRound,
                p_page: page,
                p_page_size: EXPORT_CHUNK,
              });
              if (error) throw new Error(error.message);
              rows = (data ?? []) as Record<string, unknown>[];
              const dayKeys = Array.from({ length: 31 }, (_, i) => `d${String(i + 1).padStart(2, "0")}`);
              const head = [
                "worker_id",
                "worker_name",
                "id_number",
                "site_name",
                "contractor_name",
                ...dayKeys,
                "present_days",
                "absent_days",
                "half_days",
              ];
              ensureHeader(head);
              for (const r of rows) {
                const cells = [
                  r.worker_id,
                  r.worker_name,
                  r.id_number,
                  r.site_name,
                  r.contractor_name,
                  ...dayKeys.map((k) => r[k] ?? ""),
                  r.present_days,
                  r.absent_days,
                  r.half_days,
                ];
                controller.enqueue(enc.encode(rowToCsvLine(cells) + "\n"));
              }
              break;
            }
            case "payroll": {
              const { data, error } = await supabase.rpc("get_payroll_report_page_v2", {
                p_date_start: f.dateFrom,
                p_date_end: f.dateTo,
                p_site_ids: f.siteIds,
                p_contractor_ids: f.contractorIds,
                p_supervisor_ids: f.supervisorIds,
                p_shift_round: f.shiftRound,
                p_page: page,
                p_page_size: EXPORT_CHUNK,
              });
              if (error) throw new Error(error.message);
              rows = (data ?? []) as Record<string, unknown>[];
              ensureHeader([
                "worker_id",
                "worker_name",
                "id_number",
                "site_name",
                "contractor_name",
                "supervisor_name",
                "payment_type",
                "daily_rate_sar",
                "monthly_basis_sar",
                "paid_day_equivalent",
                "gross_sar",
                "deductions_sar",
                "net_sar",
              ]);
              for (const r of rows) {
                controller.enqueue(
                  enc.encode(
                    rowToCsvLine([
                      r.worker_id,
                      r.worker_name,
                      r.id_number,
                      r.site_name,
                      r.contractor_name,
                      r.supervisor_name,
                      r.payment_type,
                      r.daily_rate_sar,
                      r.monthly_basis_sar,
                      r.paid_day_equivalent,
                      r.gross_sar,
                      r.deductions_sar,
                      r.net_sar,
                    ]) + "\n",
                  ),
                );
              }
              break;
            }
            case "contractors": {
              const { data, error } = await supabase.rpc("get_contractor_invoice_summary_page", {
                p_date_start: f.dateFrom,
                p_date_end: f.dateTo,
                p_site_ids: f.siteIds,
                p_contractor_ids: f.contractorIds,
                p_supervisor_ids: f.supervisorIds,
                p_shift_round: f.shiftRound,
                p_page: page,
                p_page_size: EXPORT_CHUNK,
              });
              if (error) throw new Error(error.message);
              rows = (data ?? []) as Record<string, unknown>[];
              ensureHeader([
                "contractor_id",
                "contractor_name",
                "workers_count",
                "paid_day_equivalent_sum",
                "gross_sar",
                "deductions_sar",
                "net_sar",
              ]);
              for (const r of rows) {
                controller.enqueue(
                  enc.encode(
                    rowToCsvLine([
                      r.contractor_id,
                      r.contractor_name,
                      r.workers_count,
                      r.paid_day_equivalent_sum,
                      r.gross_sar,
                      r.deductions_sar,
                      r.net_sar,
                    ]) + "\n",
                  ),
                );
              }
              break;
            }
            case "violations": {
              const { data, error } = await supabase.rpc("get_violations_report_page_v2", {
                p_date_from: f.dateFrom,
                p_date_to: f.dateTo,
                p_site_ids: f.siteIds,
                p_contractor_ids: f.contractorIds,
                p_supervisor_ids: f.supervisorIds,
                p_status: violationStatus && violationStatus !== "all" ? violationStatus : null,
                p_shift_round: f.shiftRound,
                p_page: page,
                p_page_size: EXPORT_CHUNK,
              });
              if (error) throw new Error(error.message);
              rows = (data ?? []) as Record<string, unknown>[];
              ensureHeader([
                "id",
                "worker_id",
                "site_id",
                "violation_status",
                "occurred_at",
                "worker_name",
                "id_number",
                "site_name",
                "violation_type",
                "deduction_this_sar",
                "period_gross_sar",
                "period_deductions_sar",
                "period_net_sar",
              ]);
              for (const r of rows) {
                controller.enqueue(
                  enc.encode(
                    rowToCsvLine([
                      r.id,
                      r.worker_id,
                      r.site_id,
                      r.status,
                      r.occurred_at,
                      r.worker_name,
                      r.worker_id_number,
                      r.site_name,
                      r.violation_type_name,
                      r.deduction_this_sar,
                      r.period_gross_sar,
                      r.period_deductions_sar,
                      r.period_net_sar,
                    ]) + "\n",
                  ),
                );
              }
              break;
            }
            case "workers": {
              const { data, error } = await supabase.rpc("get_workers_master_report_page", {
                p_site_ids: f.siteIds,
                p_contractor_ids: f.contractorIds,
                p_supervisor_ids: f.supervisorIds,
                p_status: workerStatus === "all" ? null : workerStatus,
                p_q: workerQ.trim() || null,
                p_page: page,
                p_page_size: EXPORT_CHUNK,
              });
              if (error) throw new Error(error.message);
              rows = (data ?? []) as Record<string, unknown>[];
              ensureHeader([
                "id",
                "name",
                "id_number",
                "job_title",
                "payment_type",
                "basic_salary",
                "site_name",
                "contractor_name",
                "supervisor_name",
                "shift_round",
                "iqama_expiry",
                "is_active",
                "is_deleted",
              ]);
              for (const r of rows) {
                controller.enqueue(
                  enc.encode(
                    rowToCsvLine([
                      r.id,
                      r.name,
                      r.id_number,
                      r.job_title,
                      r.payment_type,
                      r.basic_salary,
                      r.site_name,
                      r.contractor_name,
                      r.supervisor_name,
                      r.shift_round,
                      r.iqama_expiry,
                      r.is_active,
                      r.is_deleted,
                    ]) + "\n",
                  ),
                );
              }
              break;
            }
            default:
              throw new Error("Unknown report");
          }

          if (rows.length < EXPORT_CHUNK) break;
          page += 1;
        }

        controller.close();
      } catch (e) {
        const msg = e instanceof Error ? e.message : "export failed";
        controller.error(new Error(msg));
      }
    },
  });

  const safeName = `report_${report}_${Date.now()}.csv`;
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Cache-Control": "no-store",
    },
  });
}

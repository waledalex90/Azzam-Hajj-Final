import { NextRequest, NextResponse } from "next/server";

import { canExportReportTab } from "@/lib/auth/report-permissions";
import { getSessionContext } from "@/lib/auth/session";
import { buildPayrollExcelBuffer } from "@/lib/reports/build-payroll-excel";
import { buildPayrollPdfBuffer } from "@/lib/reports/build-payroll-pdf";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseIdList } from "@/lib/reports/filters";
import { EXPORT_CHUNK, REPORT_RPC_PAGE_CAP, type ReportFilters } from "@/lib/reports/queries";

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
    return new NextResponse("Unauthorized", { status: 401 });
  }
  if (!canExportReportTab(appUser, "payroll")) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const url = req.nextUrl;
  const format = (url.searchParams.get("format") || "xlsx").toLowerCase();
  if (format !== "xlsx" && format !== "pdf") {
    return new NextResponse("format must be xlsx or pdf", { status: 400 });
  }

  const f = filtersFromUrl(url);
  if (!f.dateFrom || !f.dateTo) {
    return new NextResponse("dateFrom/dateTo required", { status: 400 });
  }

  const yq = url.searchParams.get("year");
  const mq = url.searchParams.get("month");
  const rowSignRaw = (url.searchParams.get("rowSign") || "").toLowerCase();
  const includeRowSign =
    rowSignRaw === "1" || rowSignRaw === "true" || rowSignRaw === "yes";
  const footerSignRaw = (url.searchParams.get("footerSign") || "").toLowerCase();
  /** توقيع نهاية الصفحة — أو المعامل القديم sign=1 */
  const signLegacy = (url.searchParams.get("sign") || "").toLowerCase();
  const includeFooterSign =
    footerSignRaw === "1" ||
    footerSignRaw === "true" ||
    footerSignRaw === "yes" ||
    signLegacy === "1" ||
    signLegacy === "true" ||
    signLegacy === "yes";
  const d0 = new Date(f.dateFrom);
  const year = yq ? Number(yq) : d0.getFullYear();
  const month = mq ? Number(mq) : d0.getMonth() + 1;

  const supabase = createSupabaseAdminClient();
  const batchCeil = Math.min(EXPORT_CHUNK, REPORT_RPC_PAGE_CAP);
  const all: Record<string, unknown>[] = [];
  let page = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await supabase.rpc("get_payroll_report_page_v2", {
      p_date_start: f.dateFrom,
      p_date_end: f.dateTo,
      p_site_ids: f.siteIds,
      p_contractor_ids: f.contractorIds,
      p_supervisor_ids: f.supervisorIds,
      p_shift_round: f.shiftRound,
      p_page: page,
      p_page_size: batchCeil,
      p_search: null,
    });
    if (error) {
      return new NextResponse(error.message, { status: 500 });
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    for (const r of rows) {
      const rest = { ...r };
      delete rest.total_count;
      all.push(rest);
    }
    if (rows.length < batchCeil) break;
    page += 1;
  }

  const fname = `payroll_${f.dateFrom}_${f.dateTo}.${format === "pdf" ? "pdf" : "xlsx"}`;

  if (format === "xlsx") {
    const buffer = await buildPayrollExcelBuffer({
      rows: all,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
      year: Number.isFinite(year) ? year : d0.getFullYear(),
      month: Number.isFinite(month) ? month : d0.getMonth() + 1,
      includeRowSignature: includeRowSign,
      includeFooterSignature: includeFooterSign,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  }

  const out = await buildPayrollPdfBuffer({
    rows: all,
    dateFrom: f.dateFrom,
    dateTo: f.dateTo,
    year: Number.isFinite(year) ? year : d0.getFullYear(),
    month: Number.isFinite(month) ? month : d0.getMonth() + 1,
    includeRowSignature: includeRowSign,
    includeFooterSignature: includeFooterSign,
  });
  return new NextResponse(out, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}

import { NextRequest, NextResponse } from "next/server";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

import { getSessionContext } from "@/lib/auth/session";
import { buildPayrollExcelBuffer } from "@/lib/reports/build-payroll-excel";
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

const COLS: { key: string; ar: string }[] = [
  { key: "worker_id", ar: "معرف" },
  { key: "worker_name", ar: "الاسم" },
  { key: "id_number", ar: "رقم الإقامة" },
  { key: "site_name", ar: "الموقع" },
  { key: "contractor_name", ar: "المقاول" },
  { key: "work_daily_rate_sar", ar: "يومية العمل" },
  { key: "paid_day_equivalent", ar: "أيام الحضور" },
  { key: "gross_sar", ar: "الاستحقاق" },
  { key: "violation_deductions_sar", ar: "خصومات مخالفات" },
  { key: "manual_deductions_sar", ar: "خصومات يدوية" },
  { key: "net_sar", ar: "الصافي" },
];

export async function GET(req: NextRequest) {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    return new NextResponse("Unauthorized", { status: 401 });
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

  const headPdf = ["ID", "Name", "Iqama", "Site", "Contractor", "Daily rate", "Days", "Gross", "Viol.ded.", "Manual", "Net"];
  const body = all.map((r) => COLS.map((c) => (r[c.key] === null || r[c.key] === undefined ? "" : String(r[c.key]))));

  const fname = `payroll_${f.dateFrom}_${f.dateTo}.${format === "pdf" ? "pdf" : "xlsx"}`;

  if (format === "xlsx") {
    const buffer = await buildPayrollExcelBuffer({
      rows: all,
      dateFrom: f.dateFrom,
      dateTo: f.dateTo,
      year: Number.isFinite(year) ? year : d0.getFullYear(),
      month: Number.isFinite(month) ? month : d0.getMonth() + 1,
    });
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fname}"`,
      },
    });
  }

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  autoTable(doc, {
    head: [headPdf],
    body,
    styles: { font: "helvetica", fontSize: 7 },
    headStyles: { fillColor: [15, 23, 42] },
    margin: { top: 12, left: 8, right: 8 },
  });
  const out = doc.output("arraybuffer");
  return new NextResponse(out, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}

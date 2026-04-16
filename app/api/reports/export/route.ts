import { NextResponse } from "next/server";

import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import {
  getContractorsStatement,
  getMonthlyAttendanceMatrix,
  getWorkerFinancialReportAll,
  parseRoundNoFilter,
} from "@/lib/data/reports";
import { normalizeShiftRound } from "@/lib/data/attendance";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CSV_BOM, escapeCsvCell } from "@/lib/utils/csv-ar";
import { formatEquivalentDays, presentEquivalentDaysFromSymbols } from "@/lib/utils/attendance-equivalent-days";

export const runtime = "nodejs";
export const maxDuration = 300;

function numOrNull(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: Request) {
  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const appUser = await loadAppUserWithRole(user.id);
  if (!appUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";

  if (kind === "payroll" || kind === "attendance") {
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
    }
    const siteId = numOrNull(url.searchParams.get("siteId"));
    const contractorId = numOrNull(url.searchParams.get("contractorId"));
    const roundNo = parseRoundNoFilter(url.searchParams.get("rangeShift"));

    const { rows, error } = await getWorkerFinancialReportAll({
      from,
      to,
      siteId,
      contractorId,
      roundNo,
    });
    if (error) {
      return NextResponse.json({ error: "rpc_failed", detail: error }, { status: 500 });
    }

    if (kind === "attendance") {
      const header = [
        "اسم العامل",
        "رقم الهوية/الجواز",
        "المقاول",
        "الموقع",
        "أيام معادلة",
        "حاضر",
        "نصف يوم",
        "غائب",
        "الوردية",
      ];
      const lines = rows.map((r) =>
        [
          escapeCsvCell(r.worker_name),
          escapeCsvCell(r.id_number),
          escapeCsvCell(r.contractor_name),
          escapeCsvCell(r.site_name),
          String(r.equivalent_days),
          String(r.present_days),
          String(r.half_days),
          String(r.absent_days),
          escapeCsvCell(
            r.shift_round === 1 ? "صباحي" : r.shift_round === 2 ? "مسائي" : "—",
          ),
        ].join(","),
      );
      const csv = CSV_BOM + [header.join(","), ...lines].join("\n");
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="attendance-range-${from}_${to}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const header = [
      "اسم العامل",
      "رقم الهوية/الجواز",
      "المسمى",
      "المقاول",
      "الموقع",
      "التعاقد",
      "قيمة اليومية/الأساس",
      "أيام الحضور (معادلة)",
      "إجمالي المستحق",
      "خصومات المخالفات (معتمدة)",
      "الصافي",
    ];
    const lines = rows.map((r) =>
      [
        escapeCsvCell(r.worker_name),
        escapeCsvCell(r.id_number),
        escapeCsvCell(r.job_title ?? ""),
        escapeCsvCell(r.contractor_name),
        escapeCsvCell(r.site_name),
        escapeCsvCell(r.payment_type === "daily" ? "راتب يومي" : "راتب شهري"),
        String(r.basic_salary ?? ""),
        String(r.equivalent_days),
        String(r.gross_due),
        String(r.violation_deductions),
        String(r.net_due),
      ].join(","),
    );
    const csv = CSV_BOM + [header.join(","), ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="payroll-${from}_${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (kind === "contractors") {
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return NextResponse.json({ error: "invalid_dates" }, { status: 400 });
    }
    const siteId = numOrNull(url.searchParams.get("siteId"));
    const contractorId = numOrNull(url.searchParams.get("contractorId"));
    const roundNo = parseRoundNoFilter(url.searchParams.get("rangeShift"));

    const { rows, error } = await getContractorsStatement({
      from,
      to,
      siteId,
      contractorId,
      roundNo,
    });
    if (error) {
      return NextResponse.json({ error: "rpc_failed", detail: error }, { status: 500 });
    }

    const header = ["اسم المقاولة", "عدد العمال", "إجمالي المستحق", "إجمالي الخصومات", "الصافي"];
    const lines = rows.map((r) =>
      [
        escapeCsvCell(r.contractor_name),
        String(r.worker_count),
        String(r.total_due),
        String(r.total_deductions),
        String(r.net_total),
      ].join(","),
    );
    const csv = CSV_BOM + [header.join(","), ...lines].join("\n");
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contractors-${from}_${to}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (kind === "matrix") {
    const year = Number(url.searchParams.get("year"));
    const month = Number(url.searchParams.get("month"));
    if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
      return NextResponse.json({ error: "invalid_month" }, { status: 400 });
    }
    const siteId = numOrNull(url.searchParams.get("siteId"));
    const contractorId = numOrNull(url.searchParams.get("contractorId"));
    const roundNo = normalizeShiftRound(url.searchParams.get("shift"));

    const { rows: matrixRows, error } = await getMonthlyAttendanceMatrix({
      year,
      month,
      siteId,
      contractorId,
      roundNo,
    });
    if (error) {
      return NextResponse.json({ error: "rpc_failed", detail: error }, { status: 500 });
    }

    function statusLabel(s: string | null) {
      if (s === "present") return "ح";
      if (s === "absent") return "غ";
      if (s === "half") return "ن";
      return "-";
    }

    const grouped = new Map<
      number,
      { worker_name: string; id_number: string; byDay: Record<string, string> }
    >();
    for (const row of matrixRows) {
      if (!grouped.has(row.worker_id)) {
        grouped.set(row.worker_id, {
          worker_name: row.worker_name,
          id_number: row.id_number,
          byDay: {},
        });
      }
      grouped.get(row.worker_id)!.byDay[row.day] = statusLabel(row.status);
    }

    const dayCount = new Date(year, month, 0).getDate();
    const dayLabels = Array.from({ length: dayCount }, (_, i) => String(i + 1).padStart(2, "0"));

    const tableRows = Array.from(grouped.entries())
      .sort((a, b) => a[1].worker_name.localeCompare(b[1].worker_name, "ar"))
      .map(([workerId, v]) => {
        const eq = presentEquivalentDaysFromSymbols(v.byDay);
        return {
          workerId,
          ...v,
          totalEquivalent: formatEquivalentDays(eq),
        };
      });

    const header = ["الاسم", "الهوية", ...dayLabels, "الإجمالي (أيام معادلة)"];
    const lines = tableRows.map((r) =>
      [
        escapeCsvCell(r.worker_name),
        escapeCsvCell(r.id_number),
        ...dayLabels.map((d) => r.byDay[d] ?? "-"),
        escapeCsvCell(r.totalEquivalent),
      ].join(","),
    );
    const csv = CSV_BOM + [header.join(","), ...lines].join("\n");
    const fn = `attendance-matrix-${year}-${String(month).padStart(2, "0")}.csv`;
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fn}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return NextResponse.json({ error: "unknown_kind" }, { status: 400 });
}

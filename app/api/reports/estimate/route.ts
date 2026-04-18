import { NextRequest, NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { parseIdList } from "@/lib/reports/filters";
import { estimateExportTotal } from "@/lib/reports/queries";
import type { ReportFilters } from "@/lib/reports/queries";

function filtersFromRequest(url: URL): ReportFilters {
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
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl;
  const report = url.searchParams.get("report");
  if (!report) {
    return NextResponse.json({ error: "Missing report" }, { status: 400 });
  }

  const f = filtersFromRequest(url);
  if (report !== "workers" && (!f.dateFrom || !f.dateTo)) {
    return NextResponse.json({ error: "dateFrom/dateTo required" }, { status: 400 });
  }
  if (report === "matrix") {
    const y = url.searchParams.get("year");
    const m = url.searchParams.get("month");
    if (!y || !m) {
      return NextResponse.json({ error: "year/month required for matrix" }, { status: 400 });
    }
  }

  try {
    const total = await estimateExportTotal(report, f, {
      year: url.searchParams.get("year") ? Number(url.searchParams.get("year")) : undefined,
      month: url.searchParams.get("month") ? Number(url.searchParams.get("month")) : undefined,
      attendanceStatus: url.searchParams.get("attendanceStatus"),
      violationStatus: url.searchParams.get("violationStatus"),
      workerStatus: url.searchParams.get("workerStatus") ?? "all",
      workerQ: url.searchParams.get("workerQ") ?? "",
    });
    return NextResponse.json({ total });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "estimate failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

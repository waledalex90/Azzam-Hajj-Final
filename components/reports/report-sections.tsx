import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonthlyMatrixExport } from "@/components/reports/monthly-matrix-export";
import { MonthlyMatrixVirtuoso } from "@/components/reports/monthly-matrix-virtuoso";
import { FinancialReportTable } from "@/components/reports/financial-report-table";
import { ContractorsReportTable } from "@/components/reports/contractors-report-table";
import { getContractorOptionsLive, getSiteOptionsLive, normalizeShiftRound } from "@/lib/data/attendance";
import {
  countWorkersReportScope,
  getContractorsStatement,
  getMonthlyAttendanceMatrix,
  getWorkerFinancialReportAll,
  parseRoundNoFilter,
  type MonthlyMatrixRow,
} from "@/lib/data/reports";
import { formatEquivalentDays, presentEquivalentDaysFromSymbols } from "@/lib/utils/attendance-equivalent-days";

export function buildMatrixServerExportUrl(opts: {
  year: number;
  month: number;
  siteId: number | null;
  contractorId: number | null;
  shift: number;
}) {
  const p = new URLSearchParams();
  p.set("kind", "matrix");
  p.set("year", String(opts.year));
  p.set("month", String(opts.month));
  p.set("shift", String(opts.shift));
  if (opts.siteId != null) p.set("siteId", String(opts.siteId));
  if (opts.contractorId != null) p.set("contractorId", String(opts.contractorId));
  return `/api/reports/export?${p.toString()}`;
}

export function buildRangeExportUrl(
  kind: "attendance" | "payroll" | "contractors",
  opts: {
    from: string;
    to: string;
    siteId: number | null;
    contractorId: number | null;
    rangeShift: string;
  },
) {
  const p = new URLSearchParams();
  p.set("kind", kind);
  p.set("from", opts.from);
  p.set("to", opts.to);
  if (opts.siteId != null) p.set("siteId", String(opts.siteId));
  if (opts.contractorId != null) p.set("contractorId", String(opts.contractorId));
  if (opts.rangeShift && opts.rangeShift !== "all") p.set("rangeShift", opts.rangeShift);
  return `/api/reports/export?${p.toString()}`;
}

function statusLabel(s: MonthlyMatrixRow["status"]) {
  if (s === "present") return "ح";
  if (s === "absent") return "غ";
  if (s === "half") return "ن";
  return "-";
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

type Sp = {
  month?: string;
  year?: string;
  siteId?: string;
  contractorId?: string;
  shift?: string;
  from?: string;
  to?: string;
  rangeShift?: string;
};

export async function MonthlyReportSection({ sp }: { sp: Sp }) {
  const now = new Date();
  const monthNum = Math.max(1, Math.min(12, Number(sp.month) || now.getMonth() + 1));
  const yearNum = Math.max(2024, Number(sp.year) || now.getFullYear());
  const siteId = sp.siteId ? Number(sp.siteId) : null;
  const contractorId = sp.contractorId ? Number(sp.contractorId) : null;
  const roundNo = normalizeShiftRound(sp.shift);
  const sid = siteId && Number.isFinite(siteId) ? siteId : null;
  const cid = contractorId && Number.isFinite(contractorId) ? contractorId : null;

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let contractors: Awaited<ReturnType<typeof getContractorOptionsLive>> = [];
  let matrixRows: MonthlyMatrixRow[] = [];
  let matrixError: string | null = null;

  try {
    [sites, contractors, { rows: matrixRows, error: matrixError }] = await Promise.all([
      getSiteOptionsLive(),
      getContractorOptionsLive(),
      getMonthlyAttendanceMatrix({
        year: yearNum,
        month: monthNum,
        siteId: sid,
        contractorId: cid,
        roundNo,
      }),
    ]);
  } catch {
    sites = [];
    contractors = [];
    matrixRows = [];
    matrixError = "تعذّر تحميل البيانات.";
  }

  const grouped = new Map<
    number,
    {
      worker_name: string;
      id_number: string;
      byDay: Record<string, string>;
    }
  >();

  for (const row of matrixRows) {
    if (!grouped.has(row.worker_id)) {
      grouped.set(row.worker_id, { worker_name: row.worker_name, id_number: row.id_number, byDay: {} });
    }
    grouped.get(row.worker_id)!.byDay[row.day] = statusLabel(row.status);
  }

  const dayCount = daysInMonth(yearNum, monthNum);
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

  const exportRows = tableRows.map(({ worker_name, id_number, byDay, totalEquivalent }) => ({
    worker_name,
    id_number,
    byDay,
    totalEquivalent,
  }));

  const matrixServerUrl = buildMatrixServerExportUrl({
    year: yearNum,
    month: monthNum,
    siteId: sid,
    contractorId: cid,
    shift: roundNo,
  });

  return (
    <>
      <Card>
        <h2 className="text-base font-extrabold text-slate-900">تقرير الحضور الشهري (المصفوفة)</h2>
        <p className="mt-1 text-sm text-slate-600">
          مصفوفة الرقابة: سجلات <span className="font-bold">معتمدة فقط</span>؛ موقع التصفية = موقع الجولة مع{" "}
          <span className="font-bold">coalesce</span> لموقع العامل. التمرير العمودي افتراضي للأداء مع آلاف الصفوف.
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7" method="get">
          <input type="hidden" name="tab" value="monthly" />
          <Input name="month" type="number" min={1} max={12} defaultValue={String(monthNum)} placeholder="الشهر" />
          <Input name="year" type="number" min={2024} defaultValue={String(yearNum)} placeholder="السنة" />
          <select
            name="shift"
            defaultValue={String(roundNo)}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option value="1">وردية صباحي</option>
            <option value="2">وردية مسائي</option>
          </select>
          <select
            name="siteId"
            defaultValue={sp.siteId ?? ""}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="contractorId"
            defaultValue={sp.contractorId ?? ""}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-12 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white lg:col-span-2"
          >
            استخراج التقرير
          </button>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">ح = حاضر</span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">غ = غائب</span>
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">ن = نصف يوم</span>
          <MonthlyMatrixExport rows={exportRows} dayLabels={dayLabels} year={yearNum} month={monthNum} />
          <a
            href={matrixServerUrl}
            className="inline-flex min-h-9 items-center rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-800 hover:bg-slate-50"
          >
            تصدير كامل CSV (خادم)
          </a>
        </div>
      </Card>

      {matrixError ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">تعذّر جلب التقرير</p>
          <p className="mt-1 font-mono text-xs">{matrixError}</p>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <MonthlyMatrixVirtuoso dayLabels={dayLabels} tableRows={tableRows} />
        {tableRows.length === 0 && !matrixError && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات للتقرير المحدد.</div>
        )}
      </Card>
    </>
  );
}

function defaultRangeDates() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

export async function RangeReportSection({ sp }: { sp: Sp }) {
  const defaults = defaultRangeDates();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.from ?? "")) ? String(sp.from) : defaults.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.to ?? "")) ? String(sp.to) : defaults.to;
  const siteId = sp.siteId ? Number(sp.siteId) : null;
  const contractorId = sp.contractorId ? Number(sp.contractorId) : null;
  const sid = siteId && Number.isFinite(siteId) ? siteId : null;
  const cid = contractorId && Number.isFinite(contractorId) ? contractorId : null;
  const rangeShiftRaw = sp.rangeShift ?? "all";
  const roundNo = parseRoundNoFilter(rangeShiftRaw === "all" ? "" : rangeShiftRaw);

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let contractors: Awaited<ReturnType<typeof getContractorOptionsLive>> = [];
  let rows: Awaited<ReturnType<typeof getWorkerFinancialReportAll>>["rows"] = [];
  let scopeCount = 0;
  let err: string | null = null;

  try {
    const [s, c, wr, sc] = await Promise.all([
      getSiteOptionsLive(),
      getContractorOptionsLive(),
      getWorkerFinancialReportAll({ from, to, siteId: sid, contractorId: cid, roundNo }),
      countWorkersReportScope({ siteId: sid, contractorId: cid }),
    ]);
    sites = s;
    contractors = c;
    rows = wr.rows;
    err = wr.error;
    scopeCount = sc.error ? wr.rows.length : sc.count;
  } catch {
    sites = [];
    contractors = [];
    rows = [];
    err = "تعذّر تحميل البيانات.";
  }

  const exportUrl = buildRangeExportUrl("attendance", {
    from,
    to,
    siteId: sid,
    contractorId: cid,
    rangeShift: rangeShiftRaw,
  });

  return (
    <>
      <Card>
        <h2 className="text-base font-extrabold text-slate-900">تقرير الحضور الشامل (نطاق التواريخ)</h2>
        <p className="mt-1 text-sm text-slate-600">
          يشمل <span className="font-bold">كل العمال</span> المطابقين للفلتر (بدون حذف منطقي) مع تجميع السجلات المعتمدة فقط؛
          صف واحد لكل (يوم، جولة) حتى لا يُفقد أي يوم.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          نطاق العمال حسب الفلتر: <span className="font-bold tabular-nums">{scopeCount}</span> عاملًا — صفوف التقرير:{" "}
          <span className="font-bold tabular-nums">{rows.length}</span>.
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-8" method="get">
          <input type="hidden" name="tab" value="range" />
          <Input name="from" type="date" defaultValue={from} required />
          <Input name="to" type="date" defaultValue={to} required />
          <select
            name="rangeShift"
            defaultValue={rangeShiftRaw}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option value="all">كل الورديات</option>
            <option value="1">صباحي فقط</option>
            <option value="2">مسائي فقط</option>
          </select>
          <select name="siteId" defaultValue={sp.siteId ?? ""} className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="contractorId"
            defaultValue={sp.contractorId ?? ""}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-12 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white lg:col-span-2"
          >
            تطبيق
          </button>
        </form>

        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href={exportUrl}
            className="inline-flex min-h-9 items-center rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600"
          >
            تصدير CSV كامل (كل الصفوف)
          </a>
        </div>
      </Card>

      {err ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">تعذّر جلب التقرير</p>
          <p className="mt-1 font-mono text-xs">{err}</p>
          <p className="mt-2 text-xs">نفّذ في Supabase الملف `supabase_reports_extended.sql`.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <FinancialReportTable rows={rows} variant="attendance" />
        </Card>
      )}
    </>
  );
}

export async function PayrollReportSection({ sp }: { sp: Sp }) {
  const defaults = defaultRangeDates();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.from ?? "")) ? String(sp.from) : defaults.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.to ?? "")) ? String(sp.to) : defaults.to;
  const siteId = sp.siteId ? Number(sp.siteId) : null;
  const contractorId = sp.contractorId ? Number(sp.contractorId) : null;
  const sid = siteId && Number.isFinite(siteId) ? siteId : null;
  const cid = contractorId && Number.isFinite(contractorId) ? contractorId : null;
  const rangeShiftRaw = sp.rangeShift ?? "all";
  const roundNo = parseRoundNoFilter(rangeShiftRaw === "all" ? "" : rangeShiftRaw);

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let contractors: Awaited<ReturnType<typeof getContractorOptionsLive>> = [];
  let rows: Awaited<ReturnType<typeof getWorkerFinancialReportAll>>["rows"] = [];
  let err: string | null = null;

  try {
    [sites, contractors, { rows, error: err }] = await Promise.all([
      getSiteOptionsLive(),
      getContractorOptionsLive(),
      getWorkerFinancialReportAll({ from, to, siteId: sid, contractorId: cid, roundNo }),
    ]);
  } catch {
    sites = [];
    contractors = [];
    rows = [];
    err = "تعذّر تحميل البيانات.";
  }

  const exportUrl = buildRangeExportUrl("payroll", {
    from,
    to,
    siteId: sid,
    contractorId: cid,
    rangeShift: rangeShiftRaw,
  });

  return (
    <>
      <Card>
        <h2 className="text-base font-extrabold text-slate-900">كشف المسير (الرواتب)</h2>
        <p className="mt-1 text-sm text-slate-600">
          المستحق من الراتب/اليومية × أيام معادلة؛ الخصومات من <span className="font-bold">إشعارات المخالفات</span> المعتمدة
          (عمود penalty_amount في قاعدة البيانات بعد تشغيل الـ SQL).
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-8" method="get">
          <input type="hidden" name="tab" value="payroll" />
          <Input name="from" type="date" defaultValue={from} required />
          <Input name="to" type="date" defaultValue={to} required />
          <select
            name="rangeShift"
            defaultValue={rangeShiftRaw}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option value="all">كل الورديات</option>
            <option value="1">صباحي فقط</option>
            <option value="2">مسائي فقط</option>
          </select>
          <select name="siteId" defaultValue={sp.siteId ?? ""} className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="contractorId"
            defaultValue={sp.contractorId ?? ""}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-12 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white lg:col-span-2"
          >
            تطبيق
          </button>
        </form>

        <div className="mt-3">
          <a
            href={exportUrl}
            className="inline-flex min-h-9 items-center rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600"
          >
            تصدير CSV كامل (كل الصفوف + BOM)
          </a>
        </div>
      </Card>

      {err ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">تعذّر جلب التقرير</p>
          <p className="mt-1 font-mono text-xs">{err}</p>
          <p className="mt-2 text-xs">نفّذ في Supabase الملف `supabase_reports_extended.sql`.</p>
        </Card>
      ) : (
        <Card className="p-0">
          <FinancialReportTable rows={rows} variant="payroll" />
        </Card>
      )}
    </>
  );
}

export async function ContractorsReportSection({ sp }: { sp: Sp }) {
  const defaults = defaultRangeDates();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.from ?? "")) ? String(sp.from) : defaults.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.to ?? "")) ? String(sp.to) : defaults.to;
  const siteId = sp.siteId ? Number(sp.siteId) : null;
  const contractorId = sp.contractorId ? Number(sp.contractorId) : null;
  const sid = siteId && Number.isFinite(siteId) ? siteId : null;
  const cid = contractorId && Number.isFinite(contractorId) ? contractorId : null;
  const rangeShiftRaw = sp.rangeShift ?? "all";
  const roundNo = parseRoundNoFilter(rangeShiftRaw === "all" ? "" : rangeShiftRaw);

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let contractors: Awaited<ReturnType<typeof getContractorOptionsLive>> = [];
  let rows: Awaited<ReturnType<typeof getContractorsStatement>>["rows"] = [];
  let err: string | null = null;

  try {
    [sites, contractors, { rows, error: err }] = await Promise.all([
      getSiteOptionsLive(),
      getContractorOptionsLive(),
      getContractorsStatement({ from, to, siteId: sid, contractorId: cid, roundNo }),
    ]);
  } catch {
    sites = [];
    contractors = [];
    rows = [];
    err = "تعذّر تحميل البيانات.";
  }

  const exportUrl = buildRangeExportUrl("contractors", {
    from,
    to,
    siteId: sid,
    contractorId: cid,
    rangeShift: rangeShiftRaw,
  });

  return (
    <>
      <Card>
        <h2 className="text-base font-extrabold text-slate-900">بيان المقاولين</h2>
        <p className="mt-1 text-sm text-slate-600">تجميع المستحقات والخصومات (مخالفات معتمدة) والصافي لكل مقاول في نطاق التواريخ.</p>

        <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-8" method="get">
          <input type="hidden" name="tab" value="contractors" />
          <Input name="from" type="date" defaultValue={from} required />
          <Input name="to" type="date" defaultValue={to} required />
          <select
            name="rangeShift"
            defaultValue={rangeShiftRaw}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-bold"
          >
            <option value="all">كل الورديات</option>
            <option value="1">صباحي فقط</option>
            <option value="2">مسائي فقط</option>
          </select>
          <select name="siteId" defaultValue={sp.siteId ?? ""} className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm">
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="contractorId"
            defaultValue={sp.contractorId ?? ""}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="min-h-12 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white lg:col-span-2"
          >
            تطبيق
          </button>
        </form>

        <div className="mt-3">
          <a
            href={exportUrl}
            className="inline-flex min-h-9 items-center rounded-lg bg-emerald-700 px-3 text-xs font-bold text-white hover:bg-emerald-600"
          >
            تصدير CSV كامل
          </a>
        </div>
      </Card>

      {err ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">تعذّر جلب التقرير</p>
          <p className="mt-1 font-mono text-xs">{err}</p>
        </Card>
      ) : (
        <Card className="p-0">
          <ContractorsReportTable rows={rows} />
        </Card>
      )}
    </>
  );
}

/** روابط التبويب مع الحفاظ على الفلاتر الحالية قدر الإمكان. */
export function buildNavHrefs(sp: Sp): Partial<Record<"monthly" | "range" | "contractors" | "payroll" | "workers", string>> {
  const now = new Date();
  const monthNum = Math.max(1, Math.min(12, Number(sp.month) || now.getMonth() + 1));
  const yearNum = Math.max(2024, Number(sp.year) || now.getFullYear());
  const defaults = defaultRangeDates();
  const from = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.from ?? "")) ? String(sp.from) : defaults.from;
  const to = /^\d{4}-\d{2}-\d{2}$/.test(String(sp.to ?? "")) ? String(sp.to) : defaults.to;
  const rangeShift = sp.rangeShift ?? "all";

  const monthly = new URLSearchParams();
  monthly.set("tab", "monthly");
  monthly.set("month", String(monthNum));
  monthly.set("year", String(yearNum));
  if (sp.shift) monthly.set("shift", sp.shift);
  if (sp.siteId) monthly.set("siteId", sp.siteId);
  if (sp.contractorId) monthly.set("contractorId", sp.contractorId);

  const range = new URLSearchParams();
  range.set("tab", "range");
  range.set("from", from);
  range.set("to", to);
  range.set("rangeShift", rangeShift);
  if (sp.siteId) range.set("siteId", sp.siteId);
  if (sp.contractorId) range.set("contractorId", sp.contractorId);

  const contractorsP = new URLSearchParams(range);
  contractorsP.set("tab", "contractors");

  const payrollP = new URLSearchParams(range);
  payrollP.set("tab", "payroll");

  return {
    monthly: `/reports?${monthly.toString()}`,
    range: `/reports?${range.toString()}`,
    contractors: `/reports?${contractorsP.toString()}`,
    payroll: `/reports?${payrollP.toString()}`,
    workers: "/reports?tab=workers",
  };
}

export function WorkersDataReportSection() {
  return (
    <Card className="space-y-3">
      <h2 className="text-base font-extrabold text-slate-900">بيانات العمال (تصدير)</h2>
      <p className="text-sm text-slate-600">
        تصدير Excel يطابق أعمدة قالب الرفع مع عمود <span className="font-bold">الحالة</span> (نشط / غير نشط). يشمل كل الصفوف
        على دفعات من الخادم.
      </p>
      <div className="flex flex-wrap gap-2">
        <a
          href="/api/workers/data-export"
          className="inline-flex min-h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-bold text-white hover:bg-emerald-600"
        >
          تحميل بيانات العمال (Excel كامل)
        </a>
        <a
          href="/api/workers-template"
          className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50"
        >
          قالب الرفع (Excel)
        </a>
      </div>
    </Card>
  );
}

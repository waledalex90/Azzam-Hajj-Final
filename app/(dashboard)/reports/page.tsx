import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MonthlyMatrixExport } from "@/components/reports/monthly-matrix-export";
import { getContractorOptionsLive, getSiteOptionsLive, normalizeShiftRound } from "@/lib/data/attendance";
import { getMonthlyAttendanceMatrix, type MonthlyMatrixRow } from "@/lib/data/reports";
import { formatEquivalentDays, presentEquivalentDaysFromSymbols } from "@/lib/utils/attendance-equivalent-days";

type Props = {
  searchParams: Promise<{
    month?: string;
    year?: string;
    siteId?: string;
    contractorId?: string;
    shift?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

function statusLabel(s: MonthlyMatrixRow["status"]) {
  if (s === "present") return "ح";
  if (s === "absent") return "غ";
  if (s === "half") return "ن";
  return "-";
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

export default async function ReportsPage({ searchParams }: Props) {
  noStore();
  const params = await searchParams;
  const now = new Date();
  const monthNum = Math.max(1, Math.min(12, Number(params.month) || now.getMonth() + 1));
  const yearNum = Math.max(2024, Number(params.year) || now.getFullYear());
  const siteId = params.siteId ? Number(params.siteId) : null;
  const contractorId = params.contractorId ? Number(params.contractorId) : null;
  const roundNo = normalizeShiftRound(params.shift);

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

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">تقرير الحضور الشهري</h1>
        <p className="mt-1 text-sm text-slate-600">
          مصفوفة الرقابة: سجلات <span className="font-bold">معتمدة فقط</span> من التحضير، حسب الوردية المختارة. موقع التصفية =
          موقع الجولة (يوم التحضير) مع <span className="font-bold">coalesce</span> إلى موقع العامل عند الحاجة. ح = حاضر، غ = غائب، ن =
          نصف يوم.
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7" method="get">
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
            defaultValue={params.siteId ?? ""}
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
            defaultValue={params.contractorId ?? ""}
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
          <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1">- = لا سجل معتمد</span>
          <span className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 font-bold text-emerald-900">
            الإجمالي = أيام معادلة (ح ١ + ن ٠٫٥)
          </span>
          <MonthlyMatrixExport rows={exportRows} dayLabels={dayLabels} year={yearNum} month={monthNum} />
        </div>
      </Card>

      {matrixError ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <p className="font-bold">تعذّر جلب التقرير</p>
          <p className="mt-1 font-mono text-xs">{matrixError}</p>
          <p className="mt-2 text-xs">
            نفّذ في Supabase الملف{" "}
            <code className="rounded bg-white px-1">supabase_reports_monthly_matrix_rpc.sql</code> ثم أعد تحميل الـ schema.
          </p>
        </Card>
      ) : null}

      <Card className="overflow-hidden p-0">
        <div className="max-h-[min(75vh,900px)] overflow-auto">
          <table className="min-w-full text-xs" dir="rtl">
            <thead className="sticky top-0 z-10 bg-slate-100 shadow-sm">
              <tr>
                <th className="sticky right-0 z-20 min-w-[140px] bg-slate-100 px-2 py-2 text-right">العامل</th>
                {dayLabels.map((day) => (
                  <th key={day} className="min-w-[28px] px-1 py-2 text-center font-bold text-slate-700">
                    {day}
                  </th>
                ))}
                <th className="sticky left-0 z-20 min-w-[88px] border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-bold text-emerald-900">
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row) => (
                <tr key={row.workerId} className="border-t border-slate-200 hover:bg-slate-50/80">
                  <td className="sticky right-0 z-10 bg-white px-2 py-2 text-right shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    <p className="font-bold text-slate-800">{row.worker_name}</p>
                    <p className="text-[10px] text-slate-500">{row.id_number}</p>
                  </td>
                  {dayLabels.map((day) => (
                    <td key={day} className="px-1 py-2 text-center tabular-nums text-slate-700">
                      {row.byDay[day] ?? "-"}
                    </td>
                  ))}
                  <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-2 text-center font-bold tabular-nums text-emerald-900 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">
                    {row.totalEquivalent}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableRows.length === 0 && !matrixError && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات للتقرير المحدد.</div>
        )}
      </Card>
    </section>
  );
}

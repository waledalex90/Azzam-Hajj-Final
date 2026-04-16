import Link from "next/link";

import { ApprovalPendingShell } from "@/components/approval/approval-pending-shell";
import { ReviewCorrectionRequestModal } from "@/components/attendance/review-correction-request-modal";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { getAttendanceChecksPage, getPendingApprovalCheckIds, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    date?: string;
    siteId?: string;
    q?: string;
  }>;
};

const PAGE_SIZE = 25;
const PENDING_LOAD_MAX = 12000;

export default async function ApprovalPage({ searchParams }: Props) {
  const { appUser } = await getSessionContext();

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const activeTab = params.tab === "history" ? "history" : "pending";
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);
  const q = params.q?.trim();

  const sid = Number.isFinite(siteId) ? siteId : undefined;

  const [pendingBlock, historyBlock, sites, pendingFilteredTotal] = await Promise.all([
    activeTab === "pending"
      ? getAttendanceChecksPage({
          page: 1,
          pageSize: PENDING_LOAD_MAX,
          workDate,
          siteId: sid,
          search: undefined,
          confirmationStatus: "pending",
        })
      : Promise.resolve(null),
    activeTab === "history"
      ? getAttendanceChecksPage({
          page,
          pageSize: PAGE_SIZE,
          workDate,
          siteId: sid,
          search: q,
          confirmationStatus: "confirmed",
        })
      : Promise.resolve(null),
    getSiteOptions(),
    activeTab === "pending"
      ? getPendingApprovalCheckIds({
          workDate,
          siteId: sid,
          search: undefined,
        }).then((ids) => ids.length)
      : Promise.resolve(0),
  ]);

  const pendingRows = pendingBlock?.rows ?? [];
  const historyRows = historyBlock?.rows ?? [];
  const historyMeta = historyBlock?.meta;

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">اعتماد الحضور</h1>
        <div className="mt-3 flex items-center gap-2 border-b border-slate-200 text-sm">
          <Link
            href={`/approval?tab=pending&date=${workDate}${params.siteId ? `&siteId=${params.siteId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "pending" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            الاعتمادات المعلقة
          </Link>
          <Link
            href={`/approval?tab=history&date=${workDate}${params.siteId ? `&siteId=${params.siteId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "history" ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:bg-slate-100"
            }`}
          >
            الاعتمادات المعتمدة
          </Link>
        </div>
        {activeTab === "pending" ? (
          <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
            <input type="hidden" name="tab" value="pending" />
            <DatePickerField name="date" defaultValue={workDate} />
            <select
              name="siteId"
              defaultValue={params.siteId}
              className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <option value="">كل المواقع</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <div className="min-h-12 rounded border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
              البحث: فوري تحت الجدول
            </div>
            <Button type="submit">تطبيق الفلاتر</Button>
          </form>
        ) : (
          <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
            <input type="hidden" name="tab" value="history" />
            <input type="hidden" name="page" value="1" />
            <DatePickerField name="date" defaultValue={workDate} />
            <select
              name="siteId"
              defaultValue={params.siteId}
              className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3"
            >
              <option value="">كل المواقع</option>
              {sites.map((site) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
            <Input name="q" defaultValue={q} placeholder="بحث بالاسم أو الهوية" />
            <Button type="submit">تطبيق</Button>
          </form>
        )}
      </Card>

      {activeTab === "pending" ? (
        <ApprovalPendingShell
          key={`pend-${workDate}-${params.siteId ?? ""}`}
          initialRows={pendingRows}
          totalPendingFiltered={pendingFilteredTotal}
          workDate={workDate}
          siteId={params.siteId}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full border-collapse border border-slate-300 text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="border border-slate-300 px-3 py-2 text-right">العامل</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">الموقع</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">الجولة</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">الحالة</th>
                  <th className="border border-slate-300 px-3 py-2 text-right">الإجراء</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.map((row) => (
                  <tr key={row.id}>
                    <td className="border border-slate-300 px-3 py-2">
                      <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                      <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                    </td>
                    <td className="border border-slate-300 px-3 py-2">{row.sites?.name ?? "-"}</td>
                    <td className="border border-slate-300 px-3 py-2">
                      {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      {row.status === "present" ? "حاضر" : row.status === "absent" ? "غائب" : "نصف يوم"}
                    </td>
                    <td className="border border-slate-300 px-3 py-2">
                      {appUser && hasPermission(appUser, PERM.CORRECTION_REQUEST) ? (
                        <ReviewCorrectionRequestModal checkId={row.id} />
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {historyRows.length === 0 && <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات.</div>}
        </Card>
      )}

      {activeTab === "history" && historyMeta && (
        <PaginationControls
          page={historyMeta.page}
          totalPages={historyMeta.totalPages}
          basePath="/approval"
          query={{ tab: "history", date: workDate, siteId: params.siteId, q }}
        />
      )}
    </section>
  );
}

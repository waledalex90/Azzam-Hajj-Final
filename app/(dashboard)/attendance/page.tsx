import { revalidatePath } from "next/cache";
import Link from "next/link";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import {
  getAttendanceChecksPage,
  getAttendanceDayStats,
  getAttendanceLatestStatusMap,
  getAttendanceWorkerIdsForFilters,
  getAttendanceWorkersPage,
  getContractorOptions,
  getSiteOptions,
} from "@/lib/data/attendance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { parsePage } from "@/lib/utils/pagination";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    q?: string;
    siteId?: string;
    contractorId?: string;
    date?: string;
  }>;
};

const PAGE_SIZE = 25;

export default async function AttendancePage({ searchParams }: Props) {
  async function reviewAttendanceCheck(formData: FormData) {
    "use server";
    const checkId = Number(formData.get("checkId"));
    if (!checkId) return;
    if (isDemoModeEnabled()) return;

    const supabase = createSupabaseAdminClient();
    const { data: check } = await supabase
      .from("attendance_checks")
      .select("id, worker_id, attendance_rounds!inner(work_date)")
      .eq("id", checkId)
      .maybeSingle<{
        id: number;
        worker_id: number;
        attendance_rounds: { work_date: string } | { work_date: string }[] | null;
      }>();

    if (!check) return;
    const workDate = Array.isArray(check.attendance_rounds)
      ? (check.attendance_rounds[0]?.work_date ?? null)
      : (check.attendance_rounds?.work_date ?? null);
    if (!workDate) return;

    await submitAttendanceByWorkersEngine({
      items: [{ worker_id: check.worker_id, status: "present" }],
      workDate,
      note: "attendance review round",
    });
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/approval");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const activeTab = params.tab === "review" ? "review" : "workers";
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const q = params.q?.trim();
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);

  const [sites, contractors, dayStats] = await Promise.all([
    getSiteOptions(),
    getContractorOptions(),
    getAttendanceDayStats(workDate, Number.isFinite(siteId) ? siteId : undefined),
  ]);

  const workersPage =
    activeTab === "workers"
      ? await getAttendanceWorkersPage({
          page,
          pageSize: PAGE_SIZE,
          siteId: Number.isFinite(siteId) ? siteId : undefined,
          contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
          search: q,
        })
      : null;

  const initialStatusMap =
    activeTab === "workers" && workersPage
      ? await getAttendanceLatestStatusMap(
          workDate,
          workersPage.rows.map((item) => item.id),
        )
      : {};

  const filteredWorkerIds =
    activeTab === "workers"
      ? await getAttendanceWorkerIdsForFilters({
          siteId: Number.isFinite(siteId) ? siteId : undefined,
          contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
          search: q,
        })
      : [];

  const reviewedPage =
    activeTab === "review"
      ? await getAttendanceChecksPage({
          page,
          pageSize: PAGE_SIZE,
          workDate,
          siteId: Number.isFinite(siteId) ? siteId : undefined,
          search: q,
        })
      : null;

  const reviewedRows = reviewedPage?.rows ?? [];

  const reviewBadgeClass = (status: "pending" | "confirmed" | "rejected") => {
    if (status === "confirmed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
    if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
    return "bg-amber-50 text-amber-700 border-amber-200";
  };

  const reviewLabel = (status: "pending" | "confirmed" | "rejected") => {
    if (status === "confirmed") return "معتمد";
    if (status === "rejected") return "مرفوض";
    return "بانتظار الاعتماد";
  };

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">شاشة التحضير - مراقب فني</h1>
        <p className="mt-1 text-sm text-slate-600">
          عرض العمال عبر Server-side Pagination لتقليل الضغط عند 6000 عامل.
        </p>

        <div className="mt-3 flex items-center gap-2 border-b border-slate-200 text-sm">
          <Link
            href={`/attendance?tab=workers&date=${workDate}${params.siteId ? `&siteId=${params.siteId}` : ""}${params.contractorId ? `&contractorId=${params.contractorId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "workers"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            الموظفون والتحضير
          </Link>
          <Link
            href={`/attendance?tab=review&date=${workDate}${params.siteId ? `&siteId=${params.siteId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "review"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            مراجعة تحضير اليوم
          </Link>
        </div>

        <form className="mt-4 grid gap-2 sm:grid-cols-5" method="get">
          <input type="hidden" name="tab" value={activeTab} />
          <DatePickerField name="date" defaultValue={workDate} />
          <Input name="q" defaultValue={q} placeholder="بحث بالاسم أو رقم الهوية" />
          <select
            name="siteId"
            defaultValue={params.siteId}
            className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
          >
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          {activeTab === "workers" ? (
            <select
              name="contractorId"
              defaultValue={params.contractorId}
              className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base"
            >
              <option value="">كل المقاولين</option>
              {contractors.map((contractor) => (
                <option key={contractor.id} value={contractor.id}>
                  {contractor.name}
                </option>
              ))}
            </select>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-500">
              فلترة المقاول متاحة في تبويب التحضير
            </div>
          )}
          <Button type="submit" className="w-full">
            تطبيق الفلاتر
          </Button>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-4">
        <Card className="text-center">
          <p className="text-xs text-slate-500">معلّق</p>
          <p className="mt-1 text-2xl font-extrabold text-slate-700">{dayStats.pending}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">حاضر</p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-700">{dayStats.present}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">غائب</p>
          <p className="mt-1 text-2xl font-extrabold text-red-700">{dayStats.absent}</p>
        </Card>
        <Card className="text-center">
          <p className="text-xs text-slate-500">نصف يوم</p>
          <p className="mt-1 text-2xl font-extrabold text-amber-700">{dayStats.half}</p>
        </Card>
      </div>

      {activeTab === "workers" ? (
        <>
          <AttendanceWorkersTable
            rows={workersPage?.rows ?? []}
            workDate={workDate}
            initialStatusMap={initialStatusMap}
            filteredWorkerIds={filteredWorkerIds}
            filteredTotalRows={workersPage?.meta.totalRows ?? filteredWorkerIds.length}
          />
          <PaginationControls
            page={workersPage?.meta.page ?? 1}
            totalPages={workersPage?.meta.totalPages ?? 1}
            basePath="/attendance"
            query={{
              tab: "workers",
              q,
              siteId: params.siteId,
              contractorId: params.contractorId,
              date: workDate,
            }}
          />
        </>
      ) : (
        <>
          <Card className="border-dashed border-slate-200 bg-white/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-slate-800">سجلات اليوم المحضّرة للمراجعة</p>
              <p className="rounded-lg bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                إجمالي السجلات: {reviewedPage?.meta.totalRows ?? 0}
              </p>
            </div>
            <p className="mt-2 text-xs text-slate-500">
              زر <span className="font-bold text-emerald-700">مراجعة حضور</span> ينشئ جولة جديدة لنفس العامل كي يتم
              إعادة الاعتماد من المراقب الميداني.
            </p>
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="space-y-3 p-3 md:hidden">
              {reviewedRows.map((row) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                      <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                    </div>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reviewBadgeClass(
                        row.confirmation_status,
                      )}`}
                    >
                      {reviewLabel(row.confirmation_status)}
                    </span>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-600">
                    <p>الموقع: {row.sites?.name ?? "-"}</p>
                    <p>
                      الجولة: #{row.attendance_rounds?.round_no ?? "-"} / {row.attendance_rounds?.work_date ?? "-"}
                    </p>
                  </div>

                  <form action={reviewAttendanceCheck} className="mt-3">
                    <input type="hidden" name="checkId" value={row.id} />
                    <button className="w-full rounded-lg bg-[#166534] px-3 py-2 text-xs font-bold text-white">
                      مراجعة حضور
                    </button>
                  </form>
                </div>
              ))}
            </div>

            <div className="hidden overflow-x-auto md:block">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-right font-bold">العامل</th>
                    <th className="px-3 py-2 text-right font-bold">الموقع</th>
                    <th className="px-3 py-2 text-right font-bold">الجولة</th>
                    <th className="px-3 py-2 text-right font-bold">الاعتماد</th>
                    <th className="px-3 py-2 text-right font-bold">إجراء المراقب</th>
                  </tr>
                </thead>
                <tbody>
                  {reviewedRows.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50/70">
                      <td className="px-3 py-2">
                        <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                        <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                      </td>
                      <td className="px-3 py-2">{row.sites?.name ?? "-"}</td>
                      <td className="px-3 py-2">
                        {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${reviewBadgeClass(
                            row.confirmation_status,
                          )}`}
                        >
                          {reviewLabel(row.confirmation_status)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <form action={reviewAttendanceCheck}>
                          <input type="hidden" name="checkId" value={row.id} />
                          <button className="rounded-lg bg-[#166534] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#14532d]">
                            مراجعة حضور
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {reviewedRows.length === 0 && (
              <div className="p-4 text-center text-sm text-slate-500">
                لا توجد سجلات حضور اليوم لعرضها في المراجعة.
              </div>
            )}
          </Card>

          <PaginationControls
            page={reviewedPage?.meta.page ?? 1}
            totalPages={reviewedPage?.meta.totalPages ?? 1}
            basePath="/attendance"
            query={{
              tab: "review",
              q,
              siteId: params.siteId,
              date: workDate,
            }}
          />
        </>
      )}
    </section>
  );
}

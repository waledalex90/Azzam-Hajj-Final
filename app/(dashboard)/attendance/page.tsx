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
  getAttendanceWorkersPage,
  getContractorOptions,
  getSiteOptions,
} from "@/lib/data/attendance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parsePage } from "@/lib/utils/pagination";

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
  async function submitAttendanceByWorkers(
    items: Array<{ worker_id: number; status: "present" | "absent" | "half" }>,
    workDate: string,
    note: string,
  ) {
    "use server";

    if (items.length === 0) return;
    const supabase = createSupabaseAdminClient();

    const workerIds = items.map((item) => item.worker_id);
    const { data: workers, error: workerError } = await supabase
      .from("workers")
      .select("id, current_site_id")
      .in("id", workerIds);

    if (workerError || !workers || workers.length === 0) return;

    const siteMap = new Map<number, Array<{ worker_id: number; status: "present" | "absent" | "half" }>>();
    const workerSiteMap = new Map<number, number>();

    for (const worker of workers as Array<{ id: number; current_site_id: number | null }>) {
      if (worker.current_site_id) {
        workerSiteMap.set(worker.id, worker.current_site_id);
      }
    }

    for (const item of items) {
      const siteId = workerSiteMap.get(item.worker_id);
      if (!siteId) continue;
      const current = siteMap.get(siteId) ?? [];
      current.push(item);
      siteMap.set(siteId, current);
    }

    for (const [siteId, payload] of siteMap.entries()) {
      const { data: round, error: roundError } = await supabase.rpc("start_attendance_round", {
        p_site_id: siteId,
        p_work_date: workDate,
        p_round_no: null,
        p_notes: note,
      });
      if (roundError || !round?.id) continue;

      await supabase.rpc("submit_attendance_checks", {
        p_round_id: round.id,
        p_payload: payload,
      });
    }

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    revalidatePath("/approval");
  }

  async function registerAttendanceCheck(formData: FormData) {
    "use server";

    const workerId = Number(formData.get("workerId"));
    const status = String(formData.get("status") || "") as "present" | "absent" | "half";
    const workDateRaw = String(formData.get("workDate") || "").trim();
    const workDate = /^\d{4}-\d{2}-\d{2}$/.test(workDateRaw)
      ? workDateRaw
      : new Date().toISOString().slice(0, 10);
    if (!workerId || !["present", "absent", "half"].includes(status)) return;

    await submitAttendanceByWorkers([{ worker_id: workerId, status }], workDate, "manual attendance");
  }

  async function registerBulkAttendance(formData: FormData) {
    "use server";

    const workDateRaw = String(formData.get("workDate") || "").trim();
    const workDate = /^\d{4}-\d{2}-\d{2}$/.test(workDateRaw)
      ? workDateRaw
      : new Date().toISOString().slice(0, 10);
    const status = String(formData.get("status") || "") as "present" | "absent" | "half";
    const workerIdsRaw = String(formData.get("workerIds") || "[]");

    if (!["present", "absent", "half"].includes(status)) return;

    let workerIds: number[] = [];
    try {
      workerIds = JSON.parse(workerIdsRaw);
    } catch {
      return;
    }

    const uniqueWorkerIds = Array.from(new Set(workerIds.map((id) => Number(id)).filter(Boolean)));
    if (uniqueWorkerIds.length === 0) return;

    await submitAttendanceByWorkers(
      uniqueWorkerIds.map((workerId) => ({ worker_id: workerId, status })),
      workDate,
      "bulk attendance",
    );
  }

  async function reviewAttendanceCheck(formData: FormData) {
    "use server";
    const checkId = Number(formData.get("checkId"));
    if (!checkId) return;

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

    await submitAttendanceByWorkers(
      [{ worker_id: check.worker_id, status: "present" }],
      workDate,
      "attendance review round",
    );
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

  const reviewedPage =
    activeTab === "review"
      ? await getAttendanceChecksPage({
          page,
          pageSize: PAGE_SIZE,
          workDate,
          siteId: Number.isFinite(siteId) ? siteId : undefined,
          search: q,
          status: "present",
        })
      : null;

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
            className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
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
            action={registerAttendanceCheck}
            bulkAction={registerBulkAttendance}
            workDate={workDate}
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
          <Card className="overflow-hidden p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-right font-bold">العامل</th>
                    <th className="px-3 py-2 text-right font-bold">الموقع</th>
                    <th className="px-3 py-2 text-right font-bold">الجولة</th>
                    <th className="px-3 py-2 text-right font-bold">الاعتماد</th>
                    <th className="px-3 py-2 text-right font-bold">إجراء المراقب</th>
                  </tr>
                </thead>
                <tbody>
                  {(reviewedPage?.rows ?? []).map((row) => (
                    <tr key={row.id} className="border-t border-slate-200">
                      <td className="px-3 py-2">
                        <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                        <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                      </td>
                      <td className="px-3 py-2">{row.sites?.name ?? "-"}</td>
                      <td className="px-3 py-2">
                        {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                      </td>
                      <td className="px-3 py-2">
                        {row.confirmation_status === "pending"
                          ? "بانتظار الاعتماد"
                          : row.confirmation_status === "confirmed"
                            ? "معتمد"
                            : "مرفوض"}
                      </td>
                      <td className="px-3 py-2">
                        <form action={reviewAttendanceCheck}>
                          <input type="hidden" name="checkId" value={row.id} />
                          <button className="rounded-lg bg-[#166534] px-3 py-1.5 text-xs font-bold text-white">
                            مراجعة حضور
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {(reviewedPage?.rows ?? []).length === 0 && (
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

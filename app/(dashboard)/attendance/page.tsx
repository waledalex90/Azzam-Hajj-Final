import { revalidatePath } from "next/cache";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
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
    q?: string;
    siteId?: string;
    contractorId?: string;
    date?: string;
  }>;
};

const PAGE_SIZE = 25;

export default async function AttendancePage({ searchParams }: Props) {
  async function registerAttendanceCheck(formData: FormData) {
    "use server";

    const workerId = Number(formData.get("workerId"));
    const status = String(formData.get("status") || "");
    const workDateRaw = String(formData.get("workDate") || "").trim();
    const workDate = /^\d{4}-\d{2}-\d{2}$/.test(workDateRaw)
      ? workDateRaw
      : new Date().toISOString().slice(0, 10);
    if (!workerId || !["present", "absent", "half"].includes(status)) return;

    const supabase = createSupabaseAdminClient();

    const { data: worker, error: workerError } = await supabase
      .from("workers")
      .select("id, current_site_id")
      .eq("id", workerId)
      .single<{ id: number; current_site_id: number | null }>();

    if (workerError || !worker || !worker.current_site_id) return;

    const { data: round, error: roundError } = await supabase.rpc("start_attendance_round", {
      p_site_id: worker.current_site_id,
      p_work_date: workDate,
      p_round_no: null,
      p_notes: "web quick attendance",
    });
    if (roundError || !round?.id) return;

    await supabase.rpc("submit_attendance_checks", {
      p_round_id: round.id,
      p_payload: [{ worker_id: workerId, status }],
    });

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const q = params.q?.trim();
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);

  const [{ rows, meta }, sites, contractors, dayStats] = await Promise.all([
    getAttendanceWorkersPage({
      page,
      pageSize: PAGE_SIZE,
      siteId: Number.isFinite(siteId) ? siteId : undefined,
      contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
      search: q,
    }),
    getSiteOptions(),
    getContractorOptions(),
    getAttendanceDayStats(workDate, Number.isFinite(siteId) ? siteId : undefined),
  ]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">شاشة التحضير - مراقب فني</h1>
        <p className="mt-1 text-sm text-slate-600">
          عرض العمال عبر Server-side Pagination لتقليل الضغط عند 6000 عامل.
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-5" method="get">
          <Input name="date" type="date" defaultValue={workDate} />
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
          <select
            name="contractorId"
            defaultValue={params.contractorId}
            className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
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

      <AttendanceWorkersTable rows={rows} action={registerAttendanceCheck} workDate={workDate} />

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/attendance"
        query={{ q, siteId: params.siteId, contractorId: params.contractorId, date: workDate }}
      />
    </section>
  );
}

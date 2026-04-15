import { revalidatePath } from "next/cache";

import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAttendanceChecksPage, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<{
    page?: string;
    date?: string;
    siteId?: string;
    q?: string;
  }>;
};

const PAGE_SIZE = 20;

export default async function CorrectionsPage({ searchParams }: Props) {
  async function approveRequest(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const requestId = Number(formData.get("requestId"));
    if (!requestId) return;
    const supabase = createSupabaseAdminClient();
    await supabase.from("correction_requests").update({ status: "approved" }).eq("id", requestId);
    revalidatePath("/corrections");
    revalidatePath("/dashboard");
  }

  async function rejectRequest(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const requestId = Number(formData.get("requestId"));
    if (!requestId) return;
    const supabase = createSupabaseAdminClient();
    await supabase.from("correction_requests").update({ status: "rejected" }).eq("id", requestId);
    revalidatePath("/corrections");
    revalidatePath("/dashboard");
  }

  async function updateCheck(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;

    const checkId = Number(formData.get("checkId"));
    const status = String(formData.get("status") || "");
    const note = String(formData.get("note") || "").trim();
    if (!checkId || !["present", "absent", "half"].includes(status)) return;

    // Important: update the original check by check_id itself (not "today" record)
    const supabase = createSupabaseAdminClient();
    await supabase
      .from("attendance_checks")
      .update({
        status,
        confirmation_status: "pending",
        confirm_note: note || "manual correction",
        confirmed_at: null,
      })
      .eq("id", checkId);

    revalidatePath("/corrections");
    revalidatePath("/approval");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);
  const q = params.q?.trim();
  const supabase = createSupabaseAdminClient();

  const [{ rows, meta }, sites, reqRes] = await Promise.all([
    getAttendanceChecksPage({
      page,
      pageSize: PAGE_SIZE,
      workDate,
      siteId: Number.isFinite(siteId) ? siteId : undefined,
      search: q,
    }),
    getSiteOptions(),
    supabase
      .from("correction_requests")
      .select("id, attendance_id, reason, status, created_at, requester_id")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const pendingRequestsRaw = reqRes.error ? [] : ((reqRes.data ?? []) as Array<{
    id: number;
    attendance_id: number | null;
    reason: string | null;
    status: string;
    created_at: string;
    requester_id: number | null;
  }>);

  const requestAttendanceIds = Array.from(
    new Set(pendingRequestsRaw.map((item) => Number(item.attendance_id)).filter(Boolean)),
  );

  let requestChecks = new Map<
    number,
    {
      workers?: { name: string; id_number: string } | null;
      attendance_rounds?: { work_date: string; round_no: number; sites?: { name: string } | null } | null;
      status: "present" | "absent" | "half";
    }
  >();

  if (requestAttendanceIds.length > 0) {
    const { data: checkRows, error: checkErr } = await supabase
      .from("attendance_checks")
      .select("id, status, workers(name,id_number), attendance_rounds(work_date,round_no,sites(name))")
      .in("id", requestAttendanceIds);

    if (!checkErr) {
      requestChecks = new Map(
        ((checkRows ?? []) as Array<{
          id: number;
          status: "present" | "absent" | "half";
          workers?: { name: string; id_number: string } | { name: string; id_number: string }[] | null;
          attendance_rounds?:
            | { work_date: string; round_no: number; sites?: { name: string } | { name: string }[] | null }
            | {
                work_date: string;
                round_no: number;
                sites?: { name: string } | { name: string }[] | null;
              }[]
            | null;
        }>).map((row) => {
          const worker = Array.isArray(row.workers) ? (row.workers[0] ?? null) : (row.workers ?? null);
          const round = Array.isArray(row.attendance_rounds)
            ? (row.attendance_rounds[0] ?? null)
            : (row.attendance_rounds ?? null);
          const site = round?.sites ? (Array.isArray(round.sites) ? (round.sites[0] ?? null) : round.sites) : null;
          return [
            row.id,
            {
              workers: worker,
              attendance_rounds: round ? { ...round, sites: site } : null,
              status: row.status,
            },
          ];
        }),
      );
    }
  }

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">طلبات التعديل الواردة من المراقب الميداني</h1>
        <div className="mt-3 space-y-2">
          {pendingRequestsRaw.length === 0 ? (
            <p className="text-sm text-slate-500">لا توجد طلبات تعديل معلقة.</p>
          ) : (
            pendingRequestsRaw.map((req) => {
              const check = req.attendance_id ? requestChecks.get(req.attendance_id) : null;
              return (
                <div
                  key={req.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="text-sm">
                    <p className="font-bold text-slate-800">
                      {check?.workers?.name ?? "سجل حضور"} ({check?.workers?.id_number ?? "-"})
                    </p>
                    <p className="text-xs text-slate-500">
                      {check?.attendance_rounds?.sites?.name ?? "-"} | {check?.attendance_rounds?.work_date ?? "-"} / #
                      {check?.attendance_rounds?.round_no ?? "-"} | الحالة الحالية:{" "}
                      {check?.status === "present" ? "حاضر" : check?.status === "absent" ? "غائب" : "نصف يوم"}
                    </p>
                    <p className="mt-1 text-xs text-slate-700">السبب: {req.reason || "بدون سبب"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <form action={approveRequest}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <button className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white">اعتماد الطلب</button>
                    </form>
                    <form action={rejectRequest}>
                      <input type="hidden" name="requestId" value={req.id} />
                      <button className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white">رفض الطلب</button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">طلبات تعديل الحضور</h1>
        <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
          <Input type="date" name="date" defaultValue={workDate} />
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
      </Card>

      <div className="space-y-3">
        {rows.map((row) => (
          <Card key={row.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-bold text-slate-900">{row.workers?.name ?? "-"}</p>
                <p className="text-xs text-slate-500">
                  {row.workers?.id_number ?? "-"} | {row.sites?.name ?? "-"} |{" "}
                  {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                </p>
              </div>
              <form action={updateCheck} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="checkId" value={row.id} />
                <select
                  name="status"
                  defaultValue={row.status}
                  className="min-h-10 rounded border border-slate-300 bg-white px-3"
                >
                  <option value="present">حاضر</option>
                  <option value="absent">غائب</option>
                  <option value="half">نصف يوم</option>
                </select>
                <Input name="note" placeholder="سبب التعديل" className="min-w-[180px]" />
                <button className="rounded bg-[#0f766e] px-3 py-2 text-xs font-bold text-white">حفظ التعديل</button>
              </form>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <Card className="text-center text-sm text-slate-500">لا توجد سجلات مطابقة.</Card>}
      </div>

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/corrections"
        query={{ date: workDate, siteId: params.siteId, q }}
      />
    </section>
  );
}

import { revalidatePath } from "next/cache";

import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAttendanceChecksPage, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";

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
  async function updateCheck(formData: FormData) {
    "use server";

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

  const [{ rows, meta }, sites] = await Promise.all([
    getAttendanceChecksPage({
      page,
      pageSize: PAGE_SIZE,
      workDate,
      siteId: Number.isFinite(siteId) ? siteId : undefined,
      search: q,
    }),
    getSiteOptions(),
  ]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">طلبات تعديل الحضور</h1>
        <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
          <Input type="date" name="date" defaultValue={workDate} />
          <select
            name="siteId"
            defaultValue={params.siteId}
            className="min-h-12 rounded-lg border border-[#d8c99a] bg-white px-4 py-3"
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

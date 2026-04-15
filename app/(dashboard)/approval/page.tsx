import { revalidatePath } from "next/cache";

import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
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

const PAGE_SIZE = 25;

export default async function ApprovalPage({ searchParams }: Props) {
  async function confirmCheck(formData: FormData) {
    "use server";

    const checkId = Number(formData.get("checkId"));
    const action = String(formData.get("actionType") || "confirm");
    if (!checkId || !["confirm", "reject"].includes(action)) return;

    const supabase = createSupabaseAdminClient();
    const nextStatus = action === "confirm" ? "confirmed" : "rejected";
    await supabase
      .from("attendance_checks")
      .update({
        confirmation_status: nextStatus,
        confirmed_at: new Date().toISOString(),
      })
      .eq("id", checkId);

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
      confirmationStatus: "pending",
    }),
    getSiteOptions(),
  ]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">اعتماد الحضور</h1>
        <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
          <DatePickerField name="date" defaultValue={workDate} />
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

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-right">العامل</th>
                <th className="px-3 py-2 text-right">الموقع</th>
                <th className="px-3 py-2 text-right">الجولة</th>
                <th className="px-3 py-2 text-right">الحالة</th>
                <th className="px-3 py-2 text-right">الإجراء</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
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
                    {row.status === "present" ? "حاضر" : row.status === "absent" ? "غائب" : "نصف يوم"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <form action={confirmCheck}>
                        <input type="hidden" name="checkId" value={row.id} />
                        <input type="hidden" name="actionType" value="confirm" />
                        <button className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white">
                          اعتماد
                        </button>
                      </form>
                      <form action={confirmCheck}>
                        <input type="hidden" name="checkId" value={row.id} />
                        <input type="hidden" name="actionType" value="reject" />
                        <button className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white">
                          رفض
                        </button>
                      </form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات اعتماد معلقة.</div>
        )}
      </Card>

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/approval"
        query={{ date: workDate, siteId: params.siteId, q }}
      />
    </section>
  );
}

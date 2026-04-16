import { revalidatePath, revalidateTag } from "next/cache";
import Link from "next/link";

import { ApprovalQueueTable } from "@/components/approval/approval-queue-table";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Input } from "@/components/ui/input";
import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAttendanceChecksPage, getPendingApprovalCheckIds, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { applyApprovalDecisionsEngine } from "@/lib/services/attendance-engine";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";

const APPROVE_ALL_CHUNK = 500;

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

export default async function ApprovalPage({ searchParams }: Props) {
  const { appUser } = await getSessionContext();

  async function requestAttendanceCorrection(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;

    const checkId = Number(formData.get("checkId"));
    const reason = String(formData.get("reason") || "طلب تعديل حضور").trim();
    if (!checkId) return;

    const supabase = createSupabaseAdminClient();
    const requesterId = Number(formData.get("requesterId")) || null;

    const insertRes = await supabase.from("correction_requests").insert({
      attendance_id: checkId,
      requester_id: requesterId,
      reason,
      status: "pending",
    });

    // Fallback to note logging if correction_requests table is unavailable.
    if (insertRes.error) {
      await supabase
        .from("attendance_checks")
        .update({
          confirm_note: `طلب تعديل حضور: ${reason}`,
        })
        .eq("id", checkId);
    }

    revalidatePath("/approval");
    revalidatePath("/corrections");
    revalidatePath("/dashboard");
  }

  async function approveAllPendingAttendance(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;

    const { appUser } = await getSessionContext();
    if (!appUser || !hasPermission(appUser, PERM.APPROVAL)) return;

    const workDate = String(formData.get("workDate") || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) return;
    const siteRaw = formData.get("siteId");
    const siteIdStr = siteRaw != null ? String(siteRaw).trim() : "";
    const siteId = siteIdStr ? Number(siteIdStr) : undefined;
    const q = String(formData.get("q") || "").trim();

    const ids = await getPendingApprovalCheckIds({
      workDate,
      siteId: Number.isFinite(siteId) ? siteId : undefined,
      search: q || undefined,
    });
    if (ids.length === 0) return;

    for (let i = 0; i < ids.length; i += APPROVE_ALL_CHUNK) {
      const chunk = ids.slice(i, i + APPROVE_ALL_CHUNK);
      await applyApprovalDecisionsEngine({ checkIds: chunk, decision: "confirm" });
    }

    revalidatePath("/approval");
    revalidatePath("/dashboard");
    revalidatePath("/attendance");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-admin", "max");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const activeTab = params.tab === "history" ? "history" : "pending";
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
      confirmationStatus: activeTab === "pending" ? "pending" : undefined,
    }),
    getSiteOptions(),
  ]);

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
            عرض اعتمادات اليوم
          </Link>
        </div>
        <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
          <input type="hidden" name="tab" value={activeTab} />
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
      </Card>

      {activeTab === "pending" && appUser && hasPermission(appUser, PERM.APPROVAL) && (
        <Card className="border-dashed border-emerald-200 bg-emerald-50/60">
          <form action={approveAllPendingAttendance} className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <input type="hidden" name="workDate" value={workDate} />
            <input type="hidden" name="siteId" value={params.siteId ?? ""} />
            <input type="hidden" name="q" value={q ?? ""} />
            <p className="text-sm font-bold text-slate-800">
              الاعتماد الشامل: يتم اعتماد كل السجلات المعلّقة المطابقة للتاريخ والموقع والبحث أعلاه (مثلاً آلاف السجلات دفعة واحدة).
            </p>
            <Button type="submit" className="bg-[#166534] font-extrabold text-white hover:bg-[#14532d]">
              الاعتماد الشامل
            </Button>
          </form>
        </Card>
      )}

      {activeTab === "pending" ? (
        <ApprovalQueueTable rows={rows} />
      ) : (
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
                      <form action={requestAttendanceCorrection} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="checkId" value={row.id} />
                        <input type="hidden" name="requesterId" value={appUser?.id ?? ""} />
                        <Input
                          name="reason"
                          placeholder="سبب طلب التعديل"
                          className="min-h-9 min-w-[150px] px-3 py-1 text-xs"
                        />
                        <button className="rounded bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                          طلب تعديل حضور
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length === 0 && <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات.</div>}
        </Card>
      )}

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/approval"
        query={{ tab: activeTab, date: workDate, siteId: params.siteId, q }}
      />
    </section>
  );
}

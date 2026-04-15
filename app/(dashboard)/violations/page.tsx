import { revalidatePath } from "next/cache";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ViolationsTable } from "@/components/violations/violations-table";
import { getViolationFormOptions, getViolationsPage } from "@/lib/data/violations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    status?: "pending_review" | "needs_more_info" | "approved" | "rejected";
    siteId?: string;
    workerQ?: string;
  }>;
};

const PAGE_SIZE = 20;

export default async function ViolationsPage({ searchParams }: Props) {
  async function createViolation(formData: FormData) {
    "use server";

    const workerId = Number(formData.get("workerId"));
    const violationTypeId = Number(formData.get("violationTypeId"));
    const siteIdRaw = Number(formData.get("siteId"));
    const description = String(formData.get("description") || "").trim();
    const occurredAt = String(formData.get("occurredAt") || "").trim();
    if (!workerId || !violationTypeId) return;

    const { appUser } = await getSessionContext();
    if (!appUser) return;

    const supabase = createSupabaseAdminClient();
    let finalSiteId = Number.isFinite(siteIdRaw) && siteIdRaw > 0 ? siteIdRaw : null;

    if (!finalSiteId) {
      const { data: worker } = await supabase
        .from("workers")
        .select("current_site_id")
        .eq("id", workerId)
        .single<{ current_site_id: number | null }>();
      finalSiteId = worker?.current_site_id ?? null;
    }
    if (!finalSiteId) return;

    await supabase.from("worker_violations").insert({
      worker_id: workerId,
      site_id: finalSiteId,
      violation_type_id: violationTypeId,
      description: description || null,
      occurred_at: occurredAt || new Date().toISOString(),
      reported_by: appUser.id,
      status: "pending_review",
    });

    revalidatePath("/violations");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const status = params.status;
  const workerQ = params.workerQ?.trim();

  const [{ rows, meta }, formOptions] = await Promise.all([
    getViolationsPage({
      page,
      pageSize: PAGE_SIZE,
      siteId: Number.isFinite(siteId) ? siteId : undefined,
      status,
    }),
    getViolationFormOptions(workerQ),
  ]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">شاشة المخالفات</h1>
        <p className="mt-1 text-sm text-slate-600">
          جلب البيانات يتم من السيرفر مع Pagination ودعم فلاتر الحالة والموقع.
        </p>
        <form className="mt-4 grid gap-2 sm:grid-cols-3" method="get">
          <select
            name="status"
            defaultValue={status}
            className="min-h-12 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-base"
          >
            <option value="">كل الحالات</option>
            <option value="pending_review">بانتظار المراجعة</option>
            <option value="needs_more_info">مطلوب معلومات</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
          </select>
          <Input name="siteId" defaultValue={params.siteId} placeholder="رقم الموقع (اختياري)" />
          <Button type="submit" className="w-full">
            تطبيق الفلاتر
          </Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-base font-extrabold text-slate-900">تسجيل مخالفة جديدة</h2>
        <form method="get" className="mt-3 flex gap-2">
          <Input name="workerQ" defaultValue={workerQ} placeholder="بحث عامل بالاسم أو الهوية" />
          <Button type="submit">بحث</Button>
        </form>
        <form action={createViolation} className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="sm:col-span-2 grid gap-2 sm:grid-cols-2">
            <select
              name="workerId"
              className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
              required
              defaultValue=""
            >
              <option value="" disabled>
                اختر العامل
              </option>
              {formOptions.workers.map((worker) => (
                <option key={worker.id} value={worker.id}>
                  {worker.name} - {worker.id_number}
                </option>
              ))}
            </select>
            <select
              name="violationTypeId"
              className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
              required
              defaultValue=""
            >
              <option value="" disabled>
                اختر نوع المخالفة
              </option>
              {formOptions.violationTypes.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name_ar}
                </option>
              ))}
            </select>
          </div>
          <select
            name="siteId"
            className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
            defaultValue=""
          >
            <option value="">تحديد تلقائي من موقع العامل</option>
            {formOptions.sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <Input name="occurredAt" type="datetime-local" />
          <textarea
            name="description"
            placeholder="وصف المخالفة"
            className="min-h-28 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base sm:col-span-2"
          />
          <div className="sm:col-span-2">
            <Button type="submit" className="w-full sm:w-auto">
              تسجيل المخالفة
            </Button>
          </div>
        </form>
      </Card>

      <ViolationsTable rows={rows} />

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/violations"
        query={{ status, siteId: params.siteId, workerQ }}
      />
    </section>
  );
}

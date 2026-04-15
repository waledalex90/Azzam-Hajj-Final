import { revalidatePath } from "next/cache";

import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAttendanceWorkersPage, getContractorOptions, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    siteId?: string;
    contractorId?: string;
  }>;
};

const PAGE_SIZE = 20;

export default async function TransfersPage({ searchParams }: Props) {
  async function transferWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;

    const workerId = Number(formData.get("workerId"));
    const newSiteId = Number(formData.get("newSiteId")) || null;
    const newContractorId = Number(formData.get("newContractorId")) || null;
    if (!workerId) return;

    const supabase = createSupabaseAdminClient();
    await supabase
      .from("workers")
      .update({
        current_site_id: newSiteId,
        contractor_id: newContractorId,
      })
      .eq("id", workerId);

    revalidatePath("/transfers");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const q = params.q?.trim();

  const [{ rows, meta }, sites, contractors] = await Promise.all([
    getAttendanceWorkersPage({
      page,
      pageSize: PAGE_SIZE,
      siteId: Number.isFinite(siteId) ? siteId : undefined,
      contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
      search: q,
    }),
    getSiteOptions(),
    getContractorOptions(),
  ]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">نقل الموظفين</h1>
        <form className="mt-4 grid gap-2 sm:grid-cols-4" method="get">
          <Input name="q" defaultValue={q} placeholder="بحث بالاسم أو الهوية" />
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
          <select
            name="contractorId"
            defaultValue={params.contractorId}
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <Button type="submit">تطبيق</Button>
        </form>
      </Card>

      <div className="space-y-3">
        {rows.map((worker) => (
          <Card key={worker.id}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="font-bold text-slate-900">{worker.name}</p>
                <p className="text-xs text-slate-500">
                  {worker.id_number} | الموقع الحالي: {worker.sites?.name ?? "غير محدد"} | المقاول الحالي:{" "}
                  {worker.contractors?.name ?? "غير محدد"}
                </p>
              </div>
              <form action={transferWorker} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="workerId" value={worker.id} />
                <select
                  name="newSiteId"
                  defaultValue={worker.current_site_id ?? ""}
                  className="min-h-10 rounded border border-slate-300 bg-white px-3"
                >
                  <option value="">بدون موقع</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.name}
                    </option>
                  ))}
                </select>
                <select
                  name="newContractorId"
                  defaultValue={worker.contractor_id ?? ""}
                  className="min-h-10 rounded border border-slate-300 bg-white px-3"
                >
                  <option value="">بدون مقاول</option>
                  {contractors.map((contractor) => (
                    <option key={contractor.id} value={contractor.id}>
                      {contractor.name}
                    </option>
                  ))}
                </select>
                <button className="rounded bg-[#0f766e] px-3 py-2 text-xs font-bold text-white">تنفيذ النقل</button>
              </form>
            </div>
          </Card>
        ))}
        {rows.length === 0 && <Card className="text-center text-sm text-slate-500">لا توجد بيانات.</Card>}
      </div>

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/transfers"
        query={{ q, siteId: params.siteId, contractorId: params.contractorId }}
      />
    </section>
  );
}

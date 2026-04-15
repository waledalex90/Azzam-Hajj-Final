import { revalidatePath } from "next/cache";

import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getAttendanceWorkersPage, getContractorOptions, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    siteId?: string;
    contractorId?: string;
  }>;
};

const PAGE_SIZE = 20;

export default async function WorkersPage({ searchParams }: Props) {
  async function createWorker(formData: FormData) {
    "use server";

    const name = String(formData.get("name") || "").trim();
    const idNumber = String(formData.get("idNumber") || "").trim();
    const siteId = Number(formData.get("siteId")) || null;
    const contractorId = Number(formData.get("contractorId")) || null;
    if (!name || !idNumber) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("workers").insert({
      name,
      id_number: idNumber,
      current_site_id: siteId,
      contractor_id: contractorId,
      is_active: true,
      is_deleted: false,
    });
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    const workerId = Number(formData.get("workerId"));
    const isActive = String(formData.get("isActive")) === "true";
    if (!workerId) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("workers").update({ is_active: !isActive }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const q = params.q?.trim();
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;

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
        <h1 className="text-lg font-extrabold text-slate-900">الموظفون</h1>
        <form action={createWorker} className="mt-4 grid gap-2 sm:grid-cols-5">
          <Input name="name" placeholder="اسم العامل" />
          <Input name="idNumber" placeholder="رقم الهوية/الإقامة" />
          <select name="siteId" className="min-h-12 rounded-lg border border-[#d8c99a] bg-white px-4 py-3">
            <option value="">اختر الموقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="contractorId"
            className="min-h-12 rounded-lg border border-[#d8c99a] bg-white px-4 py-3"
          >
            <option value="">اختر المقاول</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white">حفظ موظف جديد</button>
        </form>
      </Card>

      <Card>
        <form className="grid gap-2 sm:grid-cols-4" method="get">
          <Input name="q" defaultValue={q} placeholder="بحث" />
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
          <select
            name="contractorId"
            defaultValue={params.contractorId}
            className="min-h-12 rounded-lg border border-[#d8c99a] bg-white px-4 py-3"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">تصفية</button>
        </form>
      </Card>

      <div className="space-y-3">
        {rows.map((worker) => (
          <Card key={worker.id}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="font-extrabold text-slate-900">{worker.name}</p>
                <p className="text-xs text-slate-500">
                  {worker.id_number} | {worker.sites?.name ?? "بدون موقع"} |{" "}
                  {worker.contractors?.name ?? "بدون مقاول"}
                </p>
              </div>
              <form action={toggleActive}>
                <input type="hidden" name="workerId" value={worker.id} />
                <input type="hidden" name="isActive" value={String(worker.is_active)} />
                <button
                  className={`rounded px-3 py-1 text-xs font-bold text-white ${
                    worker.is_active ? "bg-emerald-700" : "bg-slate-500"
                  }`}
                >
                  {worker.is_active ? "نشط" : "موقوف"}
                </button>
              </form>
            </div>
          </Card>
        ))}
      </div>

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/workers"
        query={{ q, siteId: params.siteId, contractorId: params.contractorId }}
      />
    </section>
  );
}

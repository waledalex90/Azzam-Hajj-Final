import { revalidatePath } from "next/cache";
import Link from "next/link";

import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WorkersUploadForm } from "@/components/workers/workers-upload-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getContractorOptions, getSiteOptions } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<{
    page?: string;
    tab?: string;
    editId?: string;
    q?: string;
    siteId?: string;
    contractorId?: string;
    showStopped?: string;
    showDeleted?: string;
  }>;
};

const PAGE_SIZE = 20;

type WorkerListRow = {
  id: number;
  name: string;
  id_number: string;
  job_title: string | null;
  payment_type: "salary" | "daily";
  basic_salary: number | null;
  iqama_expiry: string | null;
  contractor_id: number | null;
  current_site_id: number | null;
  shift_round: number | null;
  is_active: boolean;
  is_deleted: boolean;
  sites?: { name: string } | { name: string }[] | null;
  contractors?: { name: string } | { name: string }[] | null;
};

function relationValue<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function boolFlag(value?: string) {
  return value === "1";
}

function normalizeText(value: unknown) {
  return String(value ?? "").trim();
}

function buildWorkersHref(query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value && value.length > 0) params.set(key, value);
  });
  return `/workers?${params.toString()}`;
}

export default async function WorkersPage({ searchParams }: Props) {
  async function createWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;

    const name = normalizeText(formData.get("name"));
    const idNumber = normalizeText(formData.get("idNumber"));
    const jobTitle = normalizeText(formData.get("jobTitle")) || null;
    const paymentType = normalizeText(formData.get("paymentType")) === "daily" ? "daily" : "salary";
    const basicSalary = Number(formData.get("basicSalary"));
    const iqamaExpiryRaw = normalizeText(formData.get("iqamaExpiry"));
    const siteId = Number(formData.get("siteId")) || null;
    const contractorId = Number(formData.get("contractorId")) || null;
    if (!name || !idNumber) return;

    const supabase = createSupabaseAdminClient();
    const { data: exists } = await supabase.from("workers").select("id").eq("id_number", idNumber).maybeSingle();
    if (exists?.id) return;

    await supabase.from("workers").insert({
      name,
      id_number: idNumber,
      job_title: jobTitle,
      payment_type: paymentType,
      basic_salary: Number.isFinite(basicSalary) ? basicSalary : null,
      iqama_expiry: /^\d{4}-\d{2}-\d{2}$/.test(iqamaExpiryRaw) ? iqamaExpiryRaw : null,
      current_site_id: siteId,
      contractor_id: contractorId,
      is_active: true,
      is_deleted: false,
    });
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  async function updateWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const workerId = Number(formData.get("workerId"));
    const name = normalizeText(formData.get("name"));
    const idNumber = normalizeText(formData.get("idNumber"));
    const jobTitle = normalizeText(formData.get("jobTitle")) || null;
    const paymentType = normalizeText(formData.get("paymentType")) === "daily" ? "daily" : "salary";
    const basicSalary = Number(formData.get("basicSalary"));
    const iqamaExpiryRaw = normalizeText(formData.get("iqamaExpiry"));
    const siteId = Number(formData.get("siteId")) || null;
    const contractorId = Number(formData.get("contractorId")) || null;
    const shiftRaw = normalizeText(formData.get("shiftRound"));
    const shift_round = shiftRaw === "1" ? 1 : shiftRaw === "2" ? 2 : null;
    if (!workerId || !name || !idNumber) return;

    const supabase = createSupabaseAdminClient();
    const { data: exists } = await supabase
      .from("workers")
      .select("id")
      .eq("id_number", idNumber)
      .neq("id", workerId)
      .maybeSingle();
    if (exists?.id) return;

    await supabase
      .from("workers")
      .update({
        name,
        id_number: idNumber,
        job_title: jobTitle,
        payment_type: paymentType,
        basic_salary: Number.isFinite(basicSalary) ? basicSalary : null,
        iqama_expiry: /^\d{4}-\d{2}-\d{2}$/.test(iqamaExpiryRaw) ? iqamaExpiryRaw : null,
        current_site_id: siteId,
        contractor_id: contractorId,
        shift_round,
      })
      .eq("id", workerId);

    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const workerId = Number(formData.get("workerId"));
    const isActive = String(formData.get("isActive")) === "true";
    if (!workerId) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("workers").update({ is_active: !isActive }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  async function softDeleteWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const workerId = Number(formData.get("workerId"));
    if (!workerId) return;
    const supabase = createSupabaseAdminClient();
    await supabase.from("workers").update({ is_deleted: true, is_active: false }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  async function restoreWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const workerId = Number(formData.get("workerId"));
    if (!workerId) return;
    const supabase = createSupabaseAdminClient();
    await supabase.from("workers").update({ is_deleted: false }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  async function refreshWorkers() {
    "use server";
    revalidatePath("/workers");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const tab = params.tab === "create" ? "create" : "list";
  const editId = Number(params.editId) || null;
  const q = params.q?.trim();
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const showStopped = boolFlag(params.showStopped);
  const showDeleted = boolFlag(params.showDeleted);

  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("workers")
    .select(
      "id, name, id_number, job_title, payment_type, basic_salary, iqama_expiry, contractor_id, current_site_id, shift_round, is_active, is_deleted, sites(name), contractors(name)",
      { count: "exact" },
    )
    .order("id", { ascending: false });

  if (showDeleted) {
    query = query.eq("is_deleted", true);
  } else {
    query = query.eq("is_deleted", false);
    if (showStopped) query = query.eq("is_active", false);
  }
  if (Number.isFinite(siteId)) query = query.eq("current_site_id", siteId);
  if (Number.isFinite(contractorId)) query = query.eq("contractor_id", contractorId);
  if (q) query = query.or(`name.ilike.%${q}%,id_number.ilike.%${q}%`);

  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const [listRes, sites, contractors, totalRes, activeRes, stoppedRes, deletedRes] = await Promise.all([
    query.range(from, to),
    getSiteOptions(),
    getContractorOptions(),
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_deleted", false),
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_deleted", false).eq("is_active", true),
    supabase
      .from("workers")
      .select("*", { count: "exact", head: true })
      .eq("is_deleted", false)
      .eq("is_active", false),
    supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_deleted", true),
  ]);

  const workers = ((listRes.data ?? []) as WorkerListRow[]).map((worker) => ({
    ...worker,
    sites: relationValue(worker.sites),
    contractors: relationValue(worker.contractors),
  }));
  const meta = buildPaginationMeta(listRes.count ?? 0, page, PAGE_SIZE);

  const queryBase = {
    tab: "list",
    q: q || undefined,
    siteId: params.siteId,
    contractorId: params.contractorId,
    showStopped: showStopped ? "1" : undefined,
    showDeleted: showDeleted ? "1" : undefined,
  };

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-extrabold text-slate-900">الموظفين</h1>
          <p className="text-xs text-slate-500">الرئيسية / الموظفين</p>
        </div>
        <div className="flex items-center gap-4 border-b border-slate-200 text-sm">
          <Link
            href="/workers?tab=list"
            className={`pb-2 font-bold ${tab === "list" ? "border-b-2 border-[#0f766e] text-slate-900" : "text-slate-500"}`}
          >
            قائمة الموظفين
          </Link>
          <Link
            href="/workers?tab=create"
            className={`pb-2 font-bold ${tab === "create" ? "border-b-2 border-[#0f766e] text-slate-900" : "text-slate-500"}`}
          >
            إضافة موظف جديد
          </Link>
        </div>
      </Card>

      {tab === "create" ? (
        <>
          <Card className="space-y-3">
            <h2 className="font-extrabold text-slate-900">استيراد من Excel</h2>
            <p className="text-xs text-slate-500">
              استخدم الشيت الجاهز. يجب أن يطابق اسم <span className="font-bold">الموقع</span> الاسم المسجّل في النظام حرفيًا. يتم
              الإضافة أو التحديث حسب رقم الهوية (Upsert).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/api/workers-template"
                className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600"
              >
                تحميل ملف Excel عربي
              </Link>
            </div>
            <WorkersUploadForm />
          </Card>

          <Card>
            <h2 className="font-extrabold text-slate-900">تسجيل موظف جديد</h2>
            <form action={createWorker} className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              <Input name="name" placeholder="الاسم الرباعي" required />
              <Input name="idNumber" placeholder="رقم الهوية / الإقامة / الجواز" required />
              <Input name="jobTitle" placeholder="المسمى الوظيفي" />
              <select
                name="contractorId"
                className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
              >
                <option value="">المقاول التابع له</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
              <select
                name="siteId"
                className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
              >
                <option value="">موقع العمل الحالي</option>
                {sites.map((site) => (
                  <option key={site.id} value={site.id}>
                    {site.name}
                  </option>
                ))}
              </select>
              <select
                name="paymentType"
                defaultValue="salary"
                className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
              >
                <option value="salary">راتب شهري</option>
                <option value="daily">راتب يومي</option>
              </select>
              <Input name="basicSalary" type="number" step="0.01" placeholder="الراتب المتفق عليه" />
              <Input name="iqamaExpiry" type="date" placeholder="تاريخ انتهاء الإقامة" />
              <div className="flex items-end">
                <button className="w-full rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600">
                  حفظ الموظف
                </button>
              </div>
            </form>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card className="text-center">
              <p className="text-2xl font-extrabold text-slate-900">{totalRes.count ?? 0}</p>
              <p className="text-xs text-slate-500">إجمالي المسجلين</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-extrabold text-emerald-700">{activeRes.count ?? 0}</p>
              <p className="text-xs text-slate-500">نشط</p>
            </Card>
            <Card className="text-center">
              <p className="text-2xl font-extrabold text-slate-700">{stoppedRes.count ?? 0}</p>
              <p className="text-xs text-slate-500">موقوف</p>
            </Card>
          </div>

          <Card>
            <form className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4" method="get">
              <input type="hidden" name="tab" value="list" />
              <Input name="q" defaultValue={q} placeholder="بحث (الاسم أو الهوية)" />
              <select
                name="siteId"
                defaultValue={params.siteId}
                className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <option value="">تصفية بالموقع</option>
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
                <option value="">تصفية بالمقاول</option>
                {contractors.map((contractor) => (
                  <option key={contractor.id} value={contractor.id}>
                    {contractor.name}
                  </option>
                ))}
              </select>
              <button className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">بحث وتصفية</button>
            </form>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                href={buildWorkersHref({
                  ...queryBase,
                  showStopped: showStopped ? undefined : "1",
                  showDeleted: undefined,
                  page: "1",
                })}
                className="rounded bg-amber-500 px-3 py-2 text-xs font-bold text-white"
              >
                {showStopped ? "إلغاء عرض الموقوفين" : "عرض الموقوفين"}
              </Link>
              <Link
                href={buildWorkersHref({
                  ...queryBase,
                  showDeleted: showDeleted ? undefined : "1",
                  showStopped: undefined,
                  page: "1",
                })}
                className="rounded bg-red-600 px-3 py-2 text-xs font-bold text-white"
              >
                {showDeleted ? `إخفاء المحذوفين (${deletedRes.count ?? 0})` : `عرض المحذوفين (${deletedRes.count ?? 0})`}
              </Link>
              <form action={refreshWorkers}>
                <button className="rounded bg-slate-700 px-3 py-2 text-xs font-bold text-white">تحديث</button>
              </form>
            </div>
          </Card>

          <div className="space-y-3">
            {workers.map((worker) => {
              const isEditing = editId === worker.id;
              return (
                <Card key={worker.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="flex flex-wrap items-center gap-2 font-extrabold text-slate-900">
                        <span>{worker.name}</span>
                        {worker.shift_round === 1 ? (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                            صباحي
                          </span>
                        ) : worker.shift_round === 2 ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-900">
                            مسائي
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                            الورديتان
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {worker.id_number} | {worker.sites?.name ?? "بدون موقع"} |{" "}
                        {worker.contractors?.name ?? "بدون مقاول"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {!worker.is_deleted && (
                        <form action={toggleActive}>
                          <input type="hidden" name="workerId" value={worker.id} />
                          <input type="hidden" name="isActive" value={String(worker.is_active)} />
                          <button
                            className={`rounded px-3 py-1 text-xs font-bold text-white ${
                              worker.is_active ? "bg-emerald-600" : "bg-slate-500"
                            }`}
                          >
                            {worker.is_active ? "نشط" : "موقوف"}
                          </button>
                        </form>
                      )}

                      <Link
                        href={buildWorkersHref({
                          ...queryBase,
                          editId: isEditing ? undefined : String(worker.id),
                          page: String(meta.page),
                        })}
                        className="rounded border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700"
                      >
                        {isEditing ? "إلغاء التعديل" : "تعديل"}
                      </Link>

                      {worker.is_deleted ? (
                        <form action={restoreWorker}>
                          <input type="hidden" name="workerId" value={worker.id} />
                          <button className="rounded bg-[#0f766e] px-3 py-1 text-xs font-bold text-white">
                            استرجاع
                          </button>
                        </form>
                      ) : (
                        <form action={softDeleteWorker}>
                          <input type="hidden" name="workerId" value={worker.id} />
                          <button className="rounded bg-red-600 px-3 py-1 text-xs font-bold text-white">حذف</button>
                        </form>
                      )}
                    </div>
                  </div>

                  {isEditing && (
                    <form action={updateWorker} className="mt-3 grid gap-2 border-t border-slate-200 pt-3 sm:grid-cols-2">
                      <input type="hidden" name="workerId" value={worker.id} />
                      <Input name="name" defaultValue={worker.name} required />
                      <Input name="idNumber" defaultValue={worker.id_number} required />
                      <Input name="jobTitle" defaultValue={worker.job_title ?? ""} placeholder="المسمى الوظيفي" />
                      <Input
                        name="basicSalary"
                        type="number"
                        step="0.01"
                        defaultValue={worker.basic_salary ?? ""}
                        placeholder="الراتب"
                      />
                      <Input name="iqamaExpiry" type="date" defaultValue={worker.iqama_expiry ?? ""} />
                      <select
                        name="paymentType"
                        defaultValue={worker.payment_type}
                        className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
                      >
                        <option value="salary">راتب شهري</option>
                        <option value="daily">راتب يومي</option>
                      </select>
                      <select
                        name="contractorId"
                        defaultValue={worker.contractor_id ?? ""}
                        className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
                      >
                        <option value="">المقاول</option>
                        {contractors.map((contractor) => (
                          <option key={contractor.id} value={contractor.id}>
                            {contractor.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="siteId"
                        defaultValue={worker.current_site_id ?? ""}
                        className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
                      >
                        <option value="">الموقع</option>
                        {sites.map((site) => (
                          <option key={site.id} value={site.id}>
                            {site.name}
                          </option>
                        ))}
                      </select>
                      <select
                        name="shiftRound"
                        defaultValue={
                          worker.shift_round === 1 ? "1" : worker.shift_round === 2 ? "2" : ""
                        }
                        className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
                      >
                        <option value="">الوردية — الورديتان</option>
                        <option value="1">صباحي</option>
                        <option value="2">مسائي</option>
                      </select>
                      <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600">
                        حفظ التعديل
                      </button>
                    </form>
                  )}
                </Card>
              );
            })}
            {workers.length === 0 && (
              <Card className="text-center text-sm text-slate-500">لا توجد بيانات مطابقة للفلترة الحالية.</Card>
            )}
          </div>

          <form action={refreshWorkers} className="flex justify-end">
            <button className="rounded bg-slate-700 px-3 py-2 text-xs font-bold text-white">تحديث</button>
          </form>

          <PaginationControls
            page={meta.page}
            totalPages={meta.totalPages}
            basePath="/workers"
            query={{
              tab: "list",
              q: q || undefined,
              siteId: params.siteId,
              contractorId: params.contractorId,
              showStopped: showStopped ? "1" : undefined,
              showDeleted: showDeleted ? "1" : undefined,
              editId: params.editId,
            }}
          />
        </>
      )}
    </section>
  );
}

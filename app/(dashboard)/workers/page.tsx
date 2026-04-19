import { revalidatePath } from "next/cache";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WorkersListClient, type WorkersListRow } from "@/components/workers/workers-list-client";
import { WorkersUploadForm } from "@/components/workers/workers-upload-form";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getContractorOptions, getSiteOptions } from "@/lib/data/attendance";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireScreen } from "@/lib/auth/require-screen";
import { getSessionContext } from "@/lib/auth/session";
import { resolveAllowedSiteIdsForSession } from "@/lib/auth/transfer-access";
import { PERM } from "@/lib/permissions/keys";

type Props = {
  searchParams: Promise<{
    tab?: string;
    editId?: string;
    siteId?: string;
    contractorId?: string;
    /** 1 صباحي، 2 مسائي — يطابق منطق التحضير (يشمل من ليس له وردية محددة) */
    shiftRound?: string;
    showStopped?: string;
    showDeleted?: string;
  }>;
};

type RawWorkerListRow = Omit<WorkersListRow, "sites" | "contractors"> & {
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

export default async function WorkersPage({ searchParams }: Props) {
  const appUser = await requireScreen(PERM.WORKERS);
  const siteScope = await resolveAllowedSiteIdsForSession(appUser);

  async function createWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;

    const { appUser } = await getSessionContext();
    if (!appUser) return;
    const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);

    const name = normalizeText(formData.get("name"));
    const idNumber = normalizeText(formData.get("idNumber"));
    const jobTitle = normalizeText(formData.get("jobTitle")) || null;
    const paymentType = normalizeText(formData.get("paymentType")) === "daily" ? "daily" : "salary";
    const basicSalary = Number(formData.get("basicSalary"));
    const iqamaExpiryRaw = normalizeText(formData.get("iqamaExpiry"));
    let siteId = Number(formData.get("siteId")) || null;
    const contractorId = Number(formData.get("contractorId")) || null;
    if (!name || !idNumber) return;
    if (allowedSiteIds !== undefined) {
      if (allowedSiteIds.length === 0) return;
      if (siteId == null || !allowedSiteIds.includes(siteId)) return;
    }

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
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  async function updateWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const { appUser } = await getSessionContext();
    if (!appUser) return;
    const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);

    const workerId = Number(formData.get("workerId"));
    const name = normalizeText(formData.get("name"));
    const idNumber = normalizeText(formData.get("idNumber"));
    const jobTitle = normalizeText(formData.get("jobTitle")) || null;
    const paymentType = normalizeText(formData.get("paymentType")) === "daily" ? "daily" : "salary";
    const basicSalary = Number(formData.get("basicSalary"));
    const iqamaExpiryRaw = normalizeText(formData.get("iqamaExpiry"));
    let siteId = Number(formData.get("siteId")) || null;
    const contractorId = Number(formData.get("contractorId")) || null;
    const shiftRaw = normalizeText(formData.get("shiftRound"));
    const shift_round = shiftRaw === "1" ? 1 : shiftRaw === "2" ? 2 : null;
    if (!workerId || !name || !idNumber) return;
    if (allowedSiteIds !== undefined) {
      if (allowedSiteIds.length === 0) return;
      if (!siteId || !allowedSiteIds.includes(siteId)) return;
    }

    const supabase = createSupabaseAdminClient();
    const { data: existingRow } = await supabase
      .from("workers")
      .select("current_site_id")
      .eq("id", workerId)
      .maybeSingle();
    if (allowedSiteIds !== undefined) {
      if (allowedSiteIds.length === 0) return;
      const prevSid = existingRow?.current_site_id ?? null;
      const wasInMySites = prevSid != null && allowedSiteIds.includes(prevSid);
      const hadNoSite = prevSid == null;
      /** عامل بلا موقع: نسمح بالتعديل إن اختير موقع ضمن صلاحياتي (تعيين أول موقع). */
      if (!wasInMySites && !hadNoSite) return;
      if (siteId == null || !allowedSiteIds.includes(siteId)) return;
    }

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
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  async function toggleActive(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const { appUser } = await getSessionContext();
    if (!appUser) return;
    const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);

    const workerId = Number(formData.get("workerId"));
    const isActive = String(formData.get("isActive")) === "true";
    if (!workerId) return;

    const supabase = createSupabaseAdminClient();
    if (allowedSiteIds !== undefined) {
      if (allowedSiteIds.length === 0) return;
      const { data: row } = await supabase.from("workers").select("current_site_id").eq("id", workerId).maybeSingle();
      const sid = row?.current_site_id ?? null;
      if (sid != null && !allowedSiteIds.includes(sid)) return;
    }
    await supabase.from("workers").update({ is_active: !isActive }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  async function softDeleteWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const { appUser } = await getSessionContext();
    if (!appUser) return;
    const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);

    const workerId = Number(formData.get("workerId"));
    if (!workerId) return;
    const supabase = createSupabaseAdminClient();
    if (allowedSiteIds !== undefined) {
      if (allowedSiteIds.length === 0) return;
      const { data: row } = await supabase.from("workers").select("current_site_id").eq("id", workerId).maybeSingle();
      const sid = row?.current_site_id ?? null;
      if (sid != null && !allowedSiteIds.includes(sid)) return;
    }
    await supabase.from("workers").update({ is_deleted: true, is_active: false }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  async function restoreWorker(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const { appUser } = await getSessionContext();
    if (!appUser) return;
    const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);

    const workerId = Number(formData.get("workerId"));
    if (!workerId) return;
    const supabase = createSupabaseAdminClient();
    if (allowedSiteIds !== undefined) {
      if (allowedSiteIds.length === 0) return;
      const { data: row } = await supabase.from("workers").select("current_site_id").eq("id", workerId).maybeSingle();
      const sid = row?.current_site_id ?? null;
      if (sid != null && !allowedSiteIds.includes(sid)) return;
    }
    await supabase.from("workers").update({ is_deleted: false }).eq("id", workerId);
    revalidatePath("/workers");
    revalidatePath("/attendance");
    revalidatePath("/dashboard");
  }

  const params = await searchParams;
  const tab = params.tab === "create" ? "create" : "list";
  const editId = Number(params.editId) || null;
  let siteId = params.siteId ? Number(params.siteId) : undefined;
  if (siteScope !== undefined) {
    if (siteScope.length === 0) {
      siteId = undefined;
    } else if (!Number.isFinite(siteId) || (siteId !== undefined && !siteScope.includes(siteId))) {
      siteId = undefined;
    }
  }
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const shiftRoundRaw = params.shiftRound?.trim();
  const shiftRoundFilter: 1 | 2 | undefined =
    shiftRoundRaw === "1" ? 1 : shiftRoundRaw === "2" ? 2 : undefined;
  const showStopped = boolFlag(params.showStopped);
  const showDeleted = boolFlag(params.showDeleted);

  const supabase = createSupabaseAdminClient();

  async function fetchWorkersListAll(): Promise<WorkersListRow[]> {
    if (siteScope !== undefined && siteScope.length === 0) {
      return [];
    }
    const CHUNK = 1000;
    const out: WorkersListRow[] = [];
    let from = 0;
    while (true) {
      let q = supabase
        .from("workers")
        .select(
          "id, name, id_number, job_title, payment_type, basic_salary, iqama_expiry, contractor_id, current_site_id, shift_round, is_active, is_deleted, sites(name), contractors(name)",
        )
        .order("id", { ascending: false });

      if (showDeleted) {
        q = q.eq("is_deleted", true);
      } else {
        q = q.eq("is_deleted", false);
        if (showStopped) q = q.eq("is_active", false);
      }
      if (siteScope !== undefined && siteScope.length > 0) {
        if (Number.isFinite(siteId) && siteId !== undefined && siteScope.includes(siteId)) {
          q = q.eq("current_site_id", siteId);
        } else {
          q = q.in("current_site_id", siteScope);
        }
      } else if (Number.isFinite(siteId)) {
        q = q.eq("current_site_id", siteId);
      }
      if (Number.isFinite(contractorId)) q = q.eq("contractor_id", contractorId);
      if (shiftRoundFilter !== undefined) {
        q = q.or(`shift_round.is.null,shift_round.eq.${shiftRoundFilter}`);
      }

      const { data, error } = await q.range(from, from + CHUNK - 1);
      if (error) break;
      const chunk = ((data ?? []) as RawWorkerListRow[]).map((worker) => ({
        ...worker,
        sites: relationValue(worker.sites),
        contractors: relationValue(worker.contractors),
      }));
      out.push(...chunk);
      if (chunk.length < CHUNK) break;
      from += CHUNK;
    }
    return out;
  }

  const [workers, sitesRaw, contractors, totalRes, activeRes, stoppedRes, deletedRes] = await Promise.all([
    fetchWorkersListAll(),
    getSiteOptions(),
    getContractorOptions(),
    (async () => {
      if (siteScope !== undefined && siteScope.length === 0) {
        return { count: 0 };
      }
      let q = supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_deleted", false);
      if (siteScope !== undefined && siteScope.length > 0) q = q.in("current_site_id", siteScope);
      return await q;
    })(),
    (async () => {
      if (siteScope !== undefined && siteScope.length === 0) {
        return { count: 0 };
      }
      let q = supabase
        .from("workers")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false)
        .eq("is_active", true);
      if (siteScope !== undefined && siteScope.length > 0) q = q.in("current_site_id", siteScope);
      return await q;
    })(),
    (async () => {
      if (siteScope !== undefined && siteScope.length === 0) {
        return { count: 0 };
      }
      let q = supabase
        .from("workers")
        .select("*", { count: "exact", head: true })
        .eq("is_deleted", false)
        .eq("is_active", false);
      if (siteScope !== undefined && siteScope.length > 0) q = q.in("current_site_id", siteScope);
      return await q;
    })(),
    (async () => {
      if (siteScope !== undefined && siteScope.length === 0) {
        return { count: 0 };
      }
      let q = supabase.from("workers").select("*", { count: "exact", head: true }).eq("is_deleted", true);
      if (siteScope !== undefined && siteScope.length > 0) q = q.in("current_site_id", siteScope);
      return await q;
    })(),
  ]);

  const sites =
    siteScope === undefined
      ? sitesRaw
      : siteScope.length > 0
        ? sitesRaw.filter((s) => siteScope.includes(s.id))
        : [];

  const queryBase = {
    tab: "list",
    siteId: params.siteId,
    contractorId: params.contractorId,
    shiftRound:
      shiftRoundFilter === 1 ? "1" : shiftRoundFilter === 2 ? "2" : undefined,
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
            <form className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5" method="get">
              <input type="hidden" name="tab" value="list" />
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
              <select
                name="shiftRound"
                defaultValue={params.shiftRound ?? ""}
                className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <option value="">كل الورديات</option>
                <option value="1">صباحي</option>
                <option value="2">مسائي</option>
              </select>
              <button className="rounded bg-[#0f766e] px-4 py-2 text-sm font-bold text-white">تطبيق التصفية</button>
            </form>
          </Card>

          <WorkersListClient
            workers={workers}
            sites={sites}
            contractors={contractors}
            queryBase={queryBase}
            editId={editId}
            showStopped={showStopped}
            showDeleted={showDeleted}
            deletedCount={deletedRes.count ?? 0}
            updateWorker={updateWorker}
            toggleActive={toggleActive}
            softDeleteWorker={softDeleteWorker}
            restoreWorker={restoreWorker}
          />
        </>
      )}
    </section>
  );
}

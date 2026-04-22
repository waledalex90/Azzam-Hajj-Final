import { revalidatePath } from "next/cache";
import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { requireScreen } from "@/lib/auth/require-screen";
import { PERM } from "@/lib/permissions/keys";

export default async function SitesPage() {
  await requireScreen(PERM.VIEW_SITES);
  noStore();

  async function createSite(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const name = String(formData.get("name") || "").trim();
    const mainContractorId = Number(formData.get("mainContractorId")) || null;
    if (!name) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("sites").insert({
      name,
      main_contractor_id: mainContractorId,
      is_active: true,
    });
    revalidatePath("/sites");
    revalidatePath("/dashboard");
  }

  async function toggleSite(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const siteId = Number(formData.get("siteId"));
    const isActive = String(formData.get("isActive")) === "true";
    if (!siteId) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("sites").update({ is_active: !isActive }).eq("id", siteId);
    revalidatePath("/sites");
    revalidatePath("/dashboard");
  }

  async function updateSiteName(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const siteId = Number(formData.get("siteId"));
    const name = String(formData.get("name") || "").trim();
    if (!siteId || !name) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("sites").update({ name }).eq("id", siteId);
    revalidatePath("/sites");
    revalidatePath("/dashboard");
    revalidatePath("/workers");
    revalidatePath("/attendance");
    revalidatePath("/approval");
  }

  const supabase = createSupabaseAdminClient();
  const [{ data: sites }, contractors] = await Promise.all([
    supabase.from("sites").select("id, name, is_active").order("id", { ascending: false }),
    supabase.from("contractors").select("id, name").order("name", { ascending: true }).then((res) => res.data ?? []),
  ]);

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">المواقع</h1>
        <form action={createSite} className="mt-4 grid gap-2 sm:grid-cols-3">
          <Input name="name" placeholder="اسم الموقع" />
          <select
            name="mainContractorId"
            className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
          >
            <option value="">المقاول الرئيسي</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-600">
            إضافة موقع
          </button>
        </form>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(sites ?? []).map((site) => (
          <Card key={site.id} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <form action={updateSiteName} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="siteId" value={site.id} />
                <Input
                  name="name"
                  defaultValue={site.name}
                  placeholder="اسم الموقع"
                  className="min-h-12 min-w-[12rem] flex-1 text-base font-extrabold text-slate-900"
                  aria-label={`تعديل اسم الموقع ${site.id}`}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700"
                >
                  حفظ الاسم
                </button>
              </form>
              <p className="text-xs text-slate-500">#{site.id}</p>
            </div>
            <form action={toggleSite} className="shrink-0 self-end sm:self-start">
              <input type="hidden" name="siteId" value={site.id} />
              <input type="hidden" name="isActive" value={String(site.is_active)} />
              <button
                className={`rounded px-3 py-1 text-xs font-bold text-white ${
                  site.is_active ? "bg-emerald-700" : "bg-slate-500"
                }`}
              >
                {site.is_active ? "مفعل" : "موقوف"}
              </button>
            </form>
          </Card>
        ))}
      </div>
    </section>
  );
}

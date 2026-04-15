import { revalidatePath, revalidateTag } from "next/cache";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type Props = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function ContractorsPage({ searchParams }: Props) {
  async function createContractor(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const name = String(formData.get("name") || "").trim();
    if (!name) return;

    const supabase = createSupabaseAdminClient();
    const { data: exists } = await supabase.from("contractors").select("id").eq("name", name).maybeSingle();
    if (exists?.id) return;

    await supabase.from("contractors").insert({ name, is_active: true });
    revalidatePath("/contractors");
    revalidatePath("/sites");
    revalidatePath("/dashboard");
    revalidateTag("contractors-options", "max");
  }

  async function toggleContractor(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const contractorId = Number(formData.get("contractorId"));
    const isActive = String(formData.get("isActive")) === "true";
    if (!contractorId) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("contractors").update({ is_active: !isActive }).eq("id", contractorId);
    revalidatePath("/contractors");
    revalidatePath("/sites");
    revalidateTag("contractors-options", "max");
  }

  async function removeContractor(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const contractorId = Number(formData.get("contractorId"));
    if (!contractorId) return;

    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.from("contractors").delete().eq("id", contractorId);

    // If contractor is already referenced by workers/sites, keep it but mark inactive.
    if (error) {
      await supabase.from("contractors").update({ is_active: false }).eq("id", contractorId);
    }

    revalidatePath("/contractors");
    revalidatePath("/sites");
    revalidatePath("/dashboard");
    revalidateTag("contractors-options", "max");
  }

  await searchParams;
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase
    .from("contractors")
    .select("id, name, is_active")
    .order("name", { ascending: true })
    .limit(200);

  const contractors = (data ?? []) as Array<{
    id: number;
    name: string;
    is_active: boolean;
  }>;

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-2xl font-extrabold text-slate-900">المقاولين</h1>
        <p className="text-xs text-slate-500">الرئيسية / المقاولين</p>

        <div className="mt-5 border-t border-slate-200 pt-4">
          <h2 className="mb-3 text-base font-extrabold text-slate-900">إضافة مقاول جديد</h2>
          <form action={createContractor} className="grid gap-2 sm:grid-cols-[auto_1fr]">
            <button className="h-10 rounded bg-black px-5 text-sm font-extrabold text-white">إضافة</button>
            <Input name="name" placeholder="اسم المقاول / الشركة" className="h-10 min-h-10 py-2 text-sm" />
          </form>
        </div>
      </Card>

      <Card className="border border-slate-200 bg-slate-50/40 p-2">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {contractors.map((contractor) => (
            <div key={contractor.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <div className="flex items-center justify-between gap-3">
                <p className="truncate text-sm font-extrabold text-slate-800">{contractor.name}</p>
                <div className="flex items-center gap-2">
                  <form action={removeContractor}>
                    <input type="hidden" name="contractorId" value={contractor.id} />
                    <button
                      type="submit"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-sm bg-[#e43d4f] text-[10px] font-bold text-white"
                      title="حذف"
                    >
                      ■
                    </button>
                  </form>
                  <form action={toggleContractor}>
                    <input type="hidden" name="contractorId" value={contractor.id} />
                    <input type="hidden" name="isActive" value={String(contractor.is_active)} />
                    <button
                      type="submit"
                      className={`relative h-6 w-11 rounded-full transition ${
                        contractor.is_active ? "bg-[#2bb24c]" : "bg-slate-400"
                      }`}
                      title={contractor.is_active ? "إيقاف" : "تفعيل"}
                    >
                      <span
                        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                          contractor.is_active ? "left-5" : "left-0.5"
                        }`}
                      />
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
      {contractors.length === 0 && (
        <Card className="text-center text-sm text-slate-500">لا يوجد مقاولون بعد.</Card>
      )}
    </section>
  );
}

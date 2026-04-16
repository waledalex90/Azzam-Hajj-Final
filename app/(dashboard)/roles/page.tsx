import { revalidatePath } from "next/cache";
import Link from "next/link";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { PERM, PERMISSION_CATALOG } from "@/lib/permissions/keys";

function slugify(raw: string): string {
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
  return s;
}

export default async function RolesPage() {
  const { appUser } = await getSessionContext();

  async function createRole(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const { appUser: actor } = await getSessionContext();
    if (!actor || !hasPermission(actor, PERM.ROLES_MANAGE)) return;

    const slugInput = String(formData.get("slug") || "").trim();
    const nameAr = String(formData.get("name_ar") || "").trim();
    const slug = slugify(slugInput || nameAr);
    if (!slug || !nameAr) return;

    const perms = PERMISSION_CATALOG.map((p) => p.key).filter(
      (key) => formData.get(`perm_${key}`) === "on",
    );

    const supabase = createSupabaseAdminClient();
    await supabase.from("user_roles").insert({
      slug,
      name_ar: nameAr,
      permissions: perms,
    });

    revalidatePath("/roles");
  }

  const supabase = createSupabaseAdminClient();
  const { data: roleRows, error: rolesLoadError } = await supabase
    .from("user_roles")
    .select("slug, name_ar, permissions, created_at")
    .order("name_ar", { ascending: true });

  const canManage = appUser && hasPermission(appUser, PERM.ROLES_MANAGE);

  if (!canManage) {
    return (
      <section className="space-y-4">
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <p className="font-extrabold">لا تملك صلاحية إدارة الأدوار.</p>
          <p className="mt-1 text-sm">يلزم صلاحية «إدارة الأدوار والصلاحيات» في دورك.</p>
          <Link href="/dashboard" className="mt-3 inline-block text-sm font-bold underline">
            العودة للرئيسية
          </Link>
        </Card>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">الأدوار والصلاحيات</h1>
        <p className="mt-1 text-sm text-slate-600">
          الأدوار تُخزَّن في جدول <code className="rounded bg-slate-100 px-1">user_roles</code>؛ أضف دوراً جديداً وحدد
          الصلاحيات يدوياً.
        </p>
      </Card>

      <Card>
        <h2 className="text-base font-extrabold text-slate-900">إضافة دور جديد</h2>
        <form action={createRole} className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">المعرّف (slug)</label>
              <Input name="slug" placeholder="مثال: site_supervisor" className="mt-1" />
              <p className="mt-1 text-[11px] text-slate-500">أحرف إنجليزية وأرقام وشرطة سفلية؛ يُستخدم عند ربط المستخدم بالدور.</p>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600">اسم الدور (عربي)</label>
              <Input name="name_ar" placeholder="مثال: مشرف موقع" className="mt-1" required />
            </div>
          </div>
          <div>
            <p className="text-xs font-bold text-slate-600">الصلاحيات</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {PERMISSION_CATALOG.map((p) => (
                <label key={p.key} className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
                  <input type="checkbox" name={`perm_${p.key}`} className="mt-0.5" />
                  <span>
                    <span className="font-bold text-slate-800">{p.label}</span>
                    <span className="mr-2 block text-[11px] text-slate-500">{p.key}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Button type="submit" className="bg-slate-900 font-extrabold text-white hover:bg-slate-800">
            حفظ الدور الجديد
          </Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
          الأدوار الحالية
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">slug</th>
                <th className="px-3 py-2 text-right">الصلاحيات</th>
              </tr>
            </thead>
            <tbody>
              {(roleRows ?? []).map((row) => {
                const perms = Array.isArray(row.permissions)
                  ? (row.permissions as string[]).join("، ")
                  : String(row.permissions ?? "");
                return (
                  <tr key={row.slug} className="border-t border-slate-200">
                    <td className="px-3 py-2 font-bold text-slate-900">{row.name_ar}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.slug}</td>
                    <td className="max-w-md px-3 py-2 text-xs text-slate-700">{perms || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rolesLoadError && (
          <div className="p-4 text-center text-sm text-red-700">
            تعذّر تحميل جدول الأدوار. تأكد من تنفيذ <code className="rounded bg-slate-100 px-1">supabase_user_roles.sql</code> في Supabase.
          </div>
        )}
        {!rolesLoadError && (roleRows ?? []).length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">
            لا توجد أدوار بعد. شغّل سكربت <code className="rounded bg-slate-100 px-1">supabase_user_roles.sql</code> في Supabase
            ثم حدّث الصفحة.
          </div>
        )}
      </Card>
    </section>
  );
}

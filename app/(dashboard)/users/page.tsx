import { revalidatePath } from "next/cache";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { PERM } from "@/lib/permissions/keys";

const LEGACY_ROLE_OPTIONS = [
  { slug: "admin", name_ar: "مدير النظام" },
  { slug: "hr", name_ar: "موارد بشرية" },
  { slug: "technical_observer", name_ar: "مراقب فني" },
  { slug: "field_observer", name_ar: "مراقب ميداني" },
] as const;

export default async function UsersPage() {
  const { appUser } = await getSessionContext();
  const canManageUsers = appUser && hasPermission(appUser, PERM.USERS_MANAGE);

  const supabase = createSupabaseAdminClient();
  const { data: roleRows } = await supabase
    .from("user_roles")
    .select("slug, name_ar")
    .order("name_ar", { ascending: true });

  const roleOptions =
    roleRows && roleRows.length > 0
      ? roleRows.map((r) => ({ slug: r.slug, name_ar: r.name_ar }))
      : [...LEGACY_ROLE_OPTIONS];

  async function createUser(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const { appUser: actor } = await getSessionContext();
    if (!actor || !hasPermission(actor, PERM.USERS_MANAGE)) return;

    const fullName = String(formData.get("fullName") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const role = String(formData.get("role") || "").trim();
    if (!fullName || !username || !role) return;

    const supabaseAdmin = createSupabaseAdminClient();
    const { data: validRows } = await supabaseAdmin.from("user_roles").select("slug");
    const allowed = new Set(
      (validRows && validRows.length > 0
        ? validRows.map((r) => r.slug)
        : LEGACY_ROLE_OPTIONS.map((r) => r.slug)) as string[],
    );
    if (!allowed.has(role)) return;

    await supabaseAdmin.from("app_users").insert({
      full_name: fullName,
      username,
      role,
    });

    revalidatePath("/users");
  }

  const { data: users } = await supabase
    .from("app_users")
    .select("id, full_name, username, role")
    .order("id", { ascending: true });

  const roleLabelBySlug = new Map(roleOptions.map((r) => [r.slug, r.name_ar]));

  return (
    <section className="space-y-4">
      {canManageUsers ? (
        <Card>
          <h1 className="text-lg font-extrabold text-slate-900">إدارة المستخدمين</h1>
          <form action={createUser} className="mt-4 grid gap-2 sm:grid-cols-4">
            <Input name="fullName" placeholder="الاسم الكامل" />
            <Input name="username" placeholder="اسم الدخول" />
            <select
              name="role"
              className="min-h-12 rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
              defaultValue="field_observer"
            >
              {roleOptions.map((role) => (
                <option key={role.slug} value={role.slug}>
                  {role.name_ar} ({role.slug})
                </option>
              ))}
            </select>
            <button className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white">إنشاء مستخدم</button>
          </form>
        </Card>
      ) : (
        <Card className="border-amber-200 bg-amber-50 text-amber-900">
          <p className="font-extrabold">عرض المستخدمين فقط — لا تملك صلاحية إنشاء مستخدمين.</p>
        </Card>
      )}

      <div className="space-y-3">
        {(users ?? []).map((user) => (
          <Card key={user.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-extrabold text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">
                  {user.username} | {roleLabelBySlug.get(user.role) ?? user.role}
                </p>
              </div>
            </div>
          </Card>
        ))}
        {(users ?? []).length === 0 && (
          <Card className="text-center text-sm text-slate-500">لا يوجد مستخدمون بعد.</Card>
        )}
      </div>
    </section>
  );
}

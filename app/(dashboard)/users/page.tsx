import Link from "next/link";
import { clsx } from "clsx";

import { Card } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { UsersManagementClient } from "@/components/users/users-management-client";
import { RolesManagementPanel } from "@/components/users/roles-management-panel";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function UsersManagementPage({ searchParams }: Props) {
  const { appUser } = await getSessionContext();
  const params = await searchParams;
  const tab = params.tab === "roles" ? "roles" : "users";

  const canUsers = Boolean(appUser && hasPermission(appUser, PERM.USERS_MANAGE));
  const canRoles = Boolean(appUser && hasPermission(appUser, PERM.ROLES_MANAGE));

  if (!canUsers && !canRoles) {
    return (
      <section className="space-y-4">
        <Card className="border-amber-200 bg-amber-50 p-4 text-amber-900">
          <p className="font-extrabold">لا تملك صلاحية الوصول لإدارة المستخدمين أو الأدوار.</p>
          <Link href="/dashboard" className="mt-2 inline-block text-sm font-bold underline">
            العودة للرئيسية
          </Link>
        </Card>
      </section>
    );
  }

  const effectiveTab = tab === "roles" && canRoles ? "roles" : canUsers ? "users" : "roles";

  const supabase = createSupabaseAdminClient();

  const { data: userRows, error: usersErr } = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, username, role, login_email, allowed_site_ids")
    .order("id", { ascending: true });

  const { data: roleRows } = await supabase.from("user_roles").select("slug, name_ar, permissions, created_at").order("name_ar");

  const { data: siteRows } = await supabase.from("sites").select("id, name").order("name");

  const users =
    userRows?.map((u) => ({
      id: u.id as number,
      auth_user_id: (u.auth_user_id as string | null) ?? null,
      full_name: u.full_name as string,
      username: u.username as string,
      role: u.role as string,
      login_email: (u as { login_email?: string | null }).login_email ?? null,
      allowed_site_ids: (u as { allowed_site_ids?: number[] | null }).allowed_site_ids ?? [],
    })) ?? [];

  const roles =
    roleRows?.map((r) => ({
      slug: r.slug as string,
      name_ar: r.name_ar as string,
      permissions: r.permissions,
    })) ?? [];

  const sites =
    siteRows?.map((s) => ({
      id: s.id as number,
      name: s.name as string,
    })) ?? [];

  return (
    <section className="space-y-4">
      <Card className="p-4">
        <h1 className="text-xl font-extrabold text-slate-900">إدارة المستخدمين والأدوار</h1>
        <p className="mt-1 text-sm text-slate-600">لوحة موحّدة: المستخدمون، الأدوار، الصلاحيات، والمواقع المسموحة.</p>
      </Card>

      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2">
        {canUsers && (
          <Link
            href="/users"
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-extrabold transition-colors",
              effectiveTab === "users" ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200",
            )}
          >
            المستخدمون
          </Link>
        )}
        {canRoles && (
          <Link
            href="/users?tab=roles"
            className={clsx(
              "rounded-lg px-4 py-2 text-sm font-extrabold transition-colors",
              effectiveTab === "roles" ? "bg-[#166534] text-white" : "bg-slate-100 text-slate-800 hover:bg-slate-200",
            )}
          >
            الأدوار والصلاحيات
          </Link>
        )}
      </div>

      {usersErr && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-800">
          تعذّر تحميل المستخدمين. نفّذ سكربت <code className="rounded bg-white px-1">supabase_app_users_allowed_sites.sql</code> إن
          لزم.
        </Card>
      )}

      {effectiveTab === "users" && canUsers && (
        <UsersManagementClient users={users} roles={roles} sites={sites} canEdit />
      )}

      {effectiveTab === "roles" && canRoles && <RolesManagementPanel roles={roleRows ?? []} />}
    </section>
  );
}

import Link from "next/link";
import { clsx } from "clsx";

import { Card } from "@/components/ui/card";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { UsersManagementClient } from "@/components/users/users-management-client";
import { RolesManagementPanel } from "@/components/users/roles-management-panel";
import { fetchAppUsersForManagement } from "@/lib/data/app-users-queries";

type Props = {
  searchParams: Promise<{ tab?: string }>;
};

export default async function UsersManagementPage({ searchParams }: Props) {
  try {
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

    let userPayload: Awaited<ReturnType<typeof fetchAppUsersForManagement>>;
    try {
      userPayload = await fetchAppUsersForManagement(supabase);
    } catch (e) {
      console.error("[users-page] fetchAppUsersForManagement threw:", e);
      userPayload = {
        rows: [],
        error: { message: e instanceof Error ? e.message : String(e) },
        usedFallbackColumns: false,
      };
    }

    console.log("[users-page] SQL user_roles + sites (admin client / service role)");
    const { data: roleRows, error: rolesErr } = await supabase
      .from("user_roles")
      .select("slug, name_ar, permissions, created_at")
      .order("name_ar");

    const { data: siteRows, error: sitesErr } = await supabase.from("sites").select("id, name").order("name");

    if (rolesErr) console.error("[users-page] user_roles query failed:", rolesErr.message, rolesErr.code, rolesErr);
    if (sitesErr) console.error("[users-page] sites query failed:", sitesErr.message, sitesErr.code, sitesErr);

    const usersErr = userPayload.error;

    const users = userPayload.rows.map((u) => ({
      id: u.id as number,
      auth_user_id: (u.auth_user_id as string | null) ?? null,
      full_name: u.full_name as string,
      username: u.username as string,
      role: u.role as string,
      login_email: u.login_email ?? null,
      allowed_site_ids: Array.isArray(u.allowed_site_ids) ? u.allowed_site_ids : [],
    }));

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
          <p className="font-extrabold">تعذّر تحميل المستخدمين</p>
          <p className="mt-1 font-mono text-xs break-words">{usersErr.message}</p>
          {usersErr.code && (
            <p className="mt-1 text-xs">
              كود: <code className="rounded bg-white px-1">{usersErr.code}</code>
            </p>
          )}
          {usersErr.details && (
            <p className="mt-1 text-xs break-words opacity-90">{usersErr.details}</p>
          )}
          <p className="mt-2 text-xs">
            إن كان الخطأ يشير لعمود غير موجود، نفّذ في SQL Editor:{" "}
            <code className="rounded bg-white px-1">supabase_app_users_allowed_sites.sql</code>
          </p>
        </Card>
      )}

      {!usersErr && userPayload.usedFallbackColumns && (
        <Card className="border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          <p className="font-bold">تنبيه: تم تحميل المستخدمين بدون أعمدة المواقع/البريد</p>
          <p className="mt-1 text-xs">
            نفّذ <code className="rounded bg-white px-1">supabase_app_users_allowed_sites.sql</code> لتفعيل{" "}
            <code className="rounded bg-white px-1">login_email</code> و<code className="rounded bg-white px-1">allowed_site_ids</code>.
          </p>
          {userPayload.attemptedDetail && (
            <p className="mt-1 font-mono text-[11px] break-words text-amber-900/90">{userPayload.attemptedDetail}</p>
          )}
        </Card>
      )}

      {(rolesErr || sitesErr) && (
        <Card className="border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {rolesErr && (
            <p>
              <span className="font-extrabold">الأدوار: </span>
              <span className="font-mono text-xs">{rolesErr.message}</span>
            </p>
          )}
          {sitesErr && (
            <p className={rolesErr ? "mt-2" : ""}>
              <span className="font-extrabold">المواقع: </span>
              <span className="font-mono text-xs">{sitesErr.message}</span>
            </p>
          )}
        </Card>
      )}

      {effectiveTab === "users" && canUsers && (
        <UsersManagementClient users={users} roles={roles} sites={sites} canEdit />
      )}

      {effectiveTab === "roles" && canRoles && <RolesManagementPanel roles={roleRows ?? []} />}
    </section>
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : "";
    console.error("[users-page] uncaught render/data error:", e);
    return (
      <section className="space-y-4">
        <Card className="border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-extrabold">خطأ أثناء تحميل صفحة المستخدمين والأدوار</p>
          <pre className="mt-2 max-h-[360px] overflow-auto whitespace-pre-wrap break-words font-mono text-xs">
            {msg}
            {stack ? `\n${stack}` : ""}
          </pre>
          <p className="mt-2 text-xs opacity-90">
            يظهر هذا النص من السيرفر مباشرة (ليس رسالة Next.js المخفية). راجع أيضاً سجلات Vercel.
          </p>
        </Card>
      </section>
    );
  }
}

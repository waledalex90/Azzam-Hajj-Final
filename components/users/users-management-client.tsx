"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PERMISSION_CATALOG } from "@/lib/permissions/keys";
import {
  bulkImportUsersAction,
  createAppUserAction,
  deleteAppUserAction,
  resetAppUserPasswordAction,
  updateAppUserAction,
} from "@/lib/actions/user-role-management";

/** تحويل نتيجة Server Action إلى void ليتوافق مع نوع form action في React 19 */
async function submitCreateAppUser(fd: FormData): Promise<void> {
  void (await createAppUserAction(fd));
}
async function submitBulkImport(fd: FormData): Promise<void> {
  void (await bulkImportUsersAction(fd));
}
async function submitDeleteAppUser(fd: FormData): Promise<void> {
  void (await deleteAppUserAction(fd));
}
async function submitUpdateAppUser(fd: FormData): Promise<void> {
  void (await updateAppUserAction(fd));
}
async function submitResetPassword(fd: FormData): Promise<void> {
  void (await resetAppUserPasswordAction(fd));
}

export type UserRow = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  username: string;
  role: string;
  login_email: string | null;
  allowed_site_ids: number[] | null;
};

export type RoleOption = { slug: string; name_ar: string; permissions: unknown };
export type SiteOption = { id: number; name: string };

type Props = {
  users: UserRow[];
  roles: RoleOption[];
  sites: SiteOption[];
  canEdit: boolean;
};

function permLabelsForRole(roles: RoleOption[], slug: string): string[] {
  const r = roles.find((x) => x.slug === slug);
  const raw = r?.permissions;
  const keys = Array.isArray(raw) ? (raw as string[]) : [];
  return PERMISSION_CATALOG.filter((p) => keys.includes(p.key)).map((p) => p.label);
}

export function UsersManagementClient({ users, roles, sites, canEdit }: Props) {
  const [q, setQ] = useState("");
  const [roleSlug, setRoleSlug] = useState(roles[0]?.slug ?? "");

  const preview = useMemo(() => permLabelsForRole(roles, roleSlug), [roles, roleSlug]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return users;
    return users.filter(
      (u) =>
        u.full_name.toLowerCase().includes(s) ||
        u.username.toLowerCase().includes(s) ||
        (u.login_email && u.login_email.toLowerCase().includes(s)) ||
        u.role.toLowerCase().includes(s),
    );
  }, [users, q]);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="text-xs font-bold text-slate-600">بحث سريع</label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="اسم، بريد، اسم دخول، دور…"
              className="mt-1"
            />
          </div>
        </div>
      </Card>

      {canEdit && (
        <>
          <Card className="p-4">
            <h3 className="text-base font-extrabold text-slate-900">إضافة مستخدم</h3>
            <form className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" action={submitCreateAppUser}>
              <div>
                <label className="text-xs font-bold text-slate-600">الاسم الكامل</label>
                <Input name="fullName" required className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">البريد (تسجيل الدخول)</label>
                <Input name="loginEmail" type="email" required className="mt-1" placeholder="name@company.com" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">اسم الدخول (عرض)</label>
                <Input name="username" required className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">كلمة المرور</label>
                <Input name="password" type="password" required minLength={6} className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">الدور</label>
                <select
                  name="role"
                  required
                  value={roleSlug}
                  onChange={(e) => setRoleSlug(e.target.value)}
                  className="mt-1 min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name_ar}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600">معرفات المواقع (اختياري، مفصولة بفواصل)</label>
                <Input name="allowedSiteIds" className="mt-1" placeholder="مثال: 1,2,3 — فارغ = كل المواقع" />
              </div>
              <div className="sm:col-span-2 lg:col-span-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-bold text-slate-600">صلاحيات الدور المختار (للاطلاع فقط)</p>
                <ul className="mt-2 list-inside list-disc text-sm text-slate-700">
                  {preview.length ? preview.map((p) => <li key={p}>{p}</li>) : <li>—</li>}
                </ul>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" className="bg-slate-900 font-bold text-white">
                  إنشاء مستخدم
                </Button>
              </div>
            </form>
          </Card>

          <Card className="p-4">
            <h3 className="text-base font-extrabold text-slate-900">استيراد من Excel</h3>
            <p className="mt-1 text-xs text-slate-600">
              صف العناوين: <code className="rounded bg-slate-100 px-1">full_name</code>،{" "}
              <code className="rounded bg-slate-100 px-1">login_email</code>،{" "}
              <code className="rounded bg-slate-100 px-1">username</code>،{" "}
              <code className="rounded bg-slate-100 px-1">password</code>،{" "}
              <code className="rounded bg-slate-100 px-1">role</code>،{" "}
              <code className="rounded bg-slate-100 px-1">site_ids</code> (اختياري)
            </p>
            <form className="mt-3 flex flex-wrap items-end gap-3" action={submitBulkImport}>
              <Input type="file" name="file" accept=".xlsx,.xls" required className="max-w-xs" />
              <Button type="submit" variant="secondary">
                رفع واستيراد
              </Button>
            </form>
          </Card>
        </>
      )}

      <Card className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
          المستخدمون ({filtered.length})
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-right">الاسم</th>
                <th className="px-3 py-2 text-right">البريد</th>
                <th className="px-3 py-2 text-right">اسم الدخول</th>
                <th className="px-3 py-2 text-right">الدور</th>
                <th className="px-3 py-2 text-right">المواقع</th>
                {canEdit && <th className="px-3 py-2 text-right">إجراءات</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <UserRowEditor key={u.id} u={u} roles={roles} sites={sites} canEdit={canEdit} />
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <p className="p-6 text-center text-slate-500">لا نتائج.</p>}
      </Card>
    </div>
  );
}

function UserRowEditor({
  u,
  roles,
  sites,
  canEdit,
}: {
  u: UserRow;
  roles: RoleOption[];
  sites: SiteOption[];
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);

  const siteLabel =
    u.allowed_site_ids && u.allowed_site_ids.length > 0
      ? u.allowed_site_ids
          .map((id) => sites.find((s) => s.id === id)?.name ?? id)
          .join("، ")
      : "الكل";

  if (!canEdit) {
    return (
      <tr className="border-t border-slate-200">
        <td className="px-3 py-2 font-bold">{u.full_name}</td>
        <td className="px-3 py-2 text-xs">{u.login_email ?? "—"}</td>
        <td className="px-3 py-2">{u.username}</td>
        <td className="px-3 py-2">{roles.find((r) => r.slug === u.role)?.name_ar ?? u.role}</td>
        <td className="max-w-[180px] px-3 py-2 text-xs text-slate-600">{siteLabel}</td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-t border-slate-200">
        <td className="px-3 py-2 font-bold">{u.full_name}</td>
        <td className="px-3 py-2 text-xs">{u.login_email ?? "—"}</td>
        <td className="px-3 py-2">{u.username}</td>
        <td className="px-3 py-2">{roles.find((r) => r.slug === u.role)?.name_ar ?? u.role}</td>
        <td className="max-w-[200px] px-3 py-2 text-xs text-slate-600">{siteLabel}</td>
        <td className="px-3 py-2">
          <div className="flex flex-wrap gap-1">
            <Button type="button" variant="secondary" className="h-8 px-2 text-xs" onClick={() => setOpen((v) => !v)}>
              {open ? "إغلاق" : "تعديل"}
            </Button>
            <form action={submitDeleteAppUser}>
              <input type="hidden" name="userId" value={u.id} />
              <Button type="submit" variant="secondary" className="h-8 px-2 text-xs text-red-800">
                حذف
              </Button>
            </form>
          </div>
        </td>
      </tr>
      {open && (
        <tr className="border-t border-slate-100 bg-slate-50">
          <td colSpan={6} className="px-3 py-4">
            <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" action={submitUpdateAppUser}>
              <input type="hidden" name="userId" value={u.id} />
              <div>
                <label className="text-xs font-bold">الاسم</label>
                <Input name="fullName" defaultValue={u.full_name} required className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold">اسم الدخول</label>
                <Input name="username" defaultValue={u.username} required className="mt-1" />
              </div>
              <div>
                <label className="text-xs font-bold">الدور</label>
                <select
                  name="role"
                  defaultValue={u.role}
                  className="mt-1 min-h-10 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm"
                >
                  {roles.map((r) => (
                    <option key={r.slug} value={r.slug}>
                      {r.name_ar}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-bold">معرفات المواقع (فارغ = كل المواقع)</label>
                <Input
                  name="allowedSiteIds"
                  defaultValue={(u.allowed_site_ids ?? []).join(",")}
                  className="mt-1"
                  placeholder="1,2,3"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-4">
                <Button type="submit" className="min-h-10 px-4 py-2 text-sm">
                  حفظ التعديل
                </Button>
              </div>
            </form>
            <form
              className="mt-3 flex flex-wrap items-end gap-2 border-t border-slate-200 pt-3"
              action={submitResetPassword}
            >
              <input type="hidden" name="userId" value={u.id} />
              <div>
                <label className="text-xs font-bold">كلمة مرور جديدة</label>
                <Input name="newPassword" type="password" minLength={6} required className="mt-1 w-48" />
              </div>
              <Button type="submit" variant="secondary" className="min-h-10 px-4 py-2 text-sm">
                إعادة تعيين كلمة المرور
              </Button>
            </form>
          </td>
        </tr>
      )}
    </>
  );
}

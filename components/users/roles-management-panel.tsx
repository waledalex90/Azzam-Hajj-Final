import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PERMISSION_CATALOG } from "@/lib/permissions/keys";
import { createRoleAction } from "@/lib/actions/user-role-management";

type RoleRow = { slug: string; name_ar: string; permissions: unknown; created_at?: string };

export function RolesManagementPanel({ roles }: { roles: RoleRow[] | null }) {
  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-base font-extrabold text-slate-900">إضافة دور جديد</h2>
        <p className="mt-1 text-xs text-slate-600">
          أي دور جديد يظهر فوراً في قوائم تعيين المستخدمين. تعديل صلاحيات الدور يؤثر على جميع من يحملون هذا الدور عند
          تسجيل الدخول التالي.
        </p>
        <form
          action={async (fd) => {
            await createRoleAction(fd);
          }}
          className="mt-4 space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-slate-600">المعرّف (slug)</label>
              <Input name="slug" placeholder="مثال: site_supervisor" className="mt-1" />
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
                <label
                  key={p.key}
                  className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                >
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
              {(roles ?? []).map((row) => {
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
        {(roles ?? []).length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد أدوار بعد.</div>
        )}
      </Card>
    </div>
  );
}

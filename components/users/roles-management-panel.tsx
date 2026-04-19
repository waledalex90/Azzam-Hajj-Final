"use client";

import { Fragment, useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { PERMISSION_CATALOG } from "@/lib/permissions/keys";
import { isValidRoleSlug } from "@/lib/permissions/role-slug";
import {
  createRoleFormAction,
  deleteRoleFormStateAction,
  updateRoleFormStateAction,
  type RoleMutationResult,
} from "@/lib/actions/user-role-management";

type RoleRow = { slug: string; name_ar: string; permissions: unknown; created_at?: string };

function permKeys(row: RoleRow): Set<string> {
  const raw = row.permissions;
  if (Array.isArray(raw)) {
    return new Set((raw as string[]).filter((k) => typeof k === "string"));
  }
  return new Set();
}

function RoleEditForm({
  role,
  onClose,
}: {
  role: RoleRow;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateRoleFormStateAction, null as RoleMutationResult | null);
  const selected = permKeys(role);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("تم حفظ الدور والصلاحيات.", { id: "role-update" });
      onClose();
      router.refresh();
    } else {
      toast.error(state.error, { id: "role-update-err", duration: 12_000 });
    }
  }, [state, onClose, router]);

  return (
    <form action={formAction} className="space-y-4 border-t border-slate-200 bg-slate-50/80 p-4 text-right">
      <input type="hidden" name="slug" value={role.slug} />
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs font-bold text-slate-600">اسم الدور (عربي)</label>
          <Input name="name_ar" required defaultValue={role.name_ar} className="mt-1" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-600">المعرّف (slug) — للقراءة فقط</label>
          <Input readOnly value={role.slug} className="mt-1 bg-slate-100 font-mono text-xs text-slate-700" />
        </div>
      </div>
      <div>
        <p className="text-xs font-bold text-slate-600">الصلاحيات</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PERMISSION_CATALOG.map((p) => (
            <label
              key={p.key}
              className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              <input type="checkbox" name={`perm_${p.key}`} defaultChecked={selected.has(p.key)} className="mt-0.5" />
              <span>
                <span className="font-bold text-slate-800">{p.label}</span>
                <span className="mr-2 block text-[11px] text-slate-500">{p.key}</span>
              </span>
            </label>
          ))}
        </div>
      </div>
      {state && !state.ok ? (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800" role="alert">
          {state.error}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          disabled={pending}
          className="bg-slate-900 font-extrabold text-white disabled:opacity-60"
        >
          {pending ? (
            <>
              <Loader2 className="me-2 inline-block h-4 w-4 animate-spin" aria-hidden />
              جاري الحفظ…
            </>
          ) : (
            "حفظ"
          )}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose}>
          إلغاء
        </Button>
      </div>
    </form>
  );
}

function DeleteBadRoleButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteRoleFormStateAction, null as RoleMutationResult | null);

  useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success("تم حذف سجل الدور غير الصالح.", { id: "role-del" });
      router.refresh();
    } else {
      toast.error(state.error, { id: "role-del-err", duration: 12_000 });
    }
  }, [state, router]);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="slug" value={slug} />
      <Button
        type="submit"
        disabled={pending}
        variant="secondary"
        className="h-8 border-red-200 bg-red-50 px-2 text-xs font-bold text-red-900 hover:bg-red-100"
        title="حذف معرّف خاطئ فقط (تنظيف)"
      >
        {pending ? "…" : "حذف (تنظيف)"}
      </Button>
    </form>
  );
}

export function RolesManagementPanel({ roles }: { roles: RoleRow[] | null }) {
  const list = roles ?? [];
  const [editingSlug, setEditingSlug] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="text-base font-extrabold text-slate-900">إضافة دور جديد</h2>
        <p className="mt-1 text-xs text-slate-600">
          أي دور جديد يظهر فوراً في قوائم تعيين المستخدمين. تعديل صلاحيات الدور يؤثر على جميع من يحملون هذا الدور عند
          تسجيل الدخول التالي.
        </p>
        <form action={createRoleFormAction} className="mt-4 space-y-4">
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
                <th className="px-3 py-2 text-right">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => {
                const perms = Array.isArray(row.permissions)
                  ? (row.permissions as string[]).join("، ")
                  : String(row.permissions ?? "");
                const showCleanup = !isValidRoleSlug(row.slug);
                const open = editingSlug === row.slug;
                return (
                  <Fragment key={row.slug}>
                    <tr className="border-t border-slate-200">
                      <td className="px-3 py-2 font-bold text-slate-900">{row.name_ar}</td>
                      <td className="px-3 py-2 font-mono text-xs text-slate-600">{row.slug}</td>
                      <td className="max-w-md px-3 py-2 text-xs text-slate-700">{perms || "—"}</td>
                      <td className="px-3 py-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            type="button"
                            variant="secondary"
                            className="h-8 px-2 text-xs font-bold"
                            onClick={() => setEditingSlug((s) => (s === row.slug ? null : row.slug))}
                          >
                            {open ? "إغلاق" : "تعديل"}
                          </Button>
                          {showCleanup ? <DeleteBadRoleButton slug={row.slug} /> : null}
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr className="border-t border-slate-100 bg-slate-50/50">
                        <td colSpan={4} className="p-0">
                          <RoleEditForm role={row} onClose={() => setEditingSlug(null)} />
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {list.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد أدوار بعد.</div>
        )}
        {list.length > 0 ? (
          <p className="border-t border-slate-100 px-3 py-2 text-[11px] text-slate-500">
            «حذف (تنظيف)» يظهر فقط للمعرّفات غير المطابقة لصيغة النظام (مثل شرطة أو رموز غير مسموحة) ولا يوجد مستخدمون
            مرتبطون بهذا الدور.
          </p>
        ) : null}
      </Card>
    </div>
  );
}

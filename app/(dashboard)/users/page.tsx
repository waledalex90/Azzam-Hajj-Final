import { revalidatePath } from "next/cache";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

const ROLES = [
  { value: "admin", label: "مدير النظام" },
  { value: "hr", label: "موارد بشرية" },
  { value: "technical_observer", label: "مراقب فني" },
  { value: "field_observer", label: "مراقب ميداني" },
] as const;

export default async function UsersPage() {
  async function createUser(formData: FormData) {
    "use server";
    if (isDemoModeEnabled()) return;
    const fullName = String(formData.get("fullName") || "").trim();
    const username = String(formData.get("username") || "").trim();
    const role = String(formData.get("role") || "field_observer");
    if (!fullName || !username || !ROLES.some((item) => item.value === role)) return;

    const supabase = createSupabaseAdminClient();
    await supabase.from("app_users").insert({
      full_name: fullName,
      username,
      role,
    });

    revalidatePath("/users");
  }

  const supabase = createSupabaseAdminClient();
  const { data: users } = await supabase
    .from("app_users")
    .select("id, full_name, username, role")
    .order("id", { ascending: true });

  return (
    <section className="space-y-4">
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
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white">إنشاء مستخدم</button>
        </form>
      </Card>

      <div className="space-y-3">
        {(users ?? []).map((user) => (
          <Card key={user.id}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-extrabold text-slate-900">{user.full_name}</p>
                <p className="text-xs text-slate-500">
                  {user.username} |{" "}
                  {ROLES.find((role) => role.value === user.role)?.label ?? String(user.role)}
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

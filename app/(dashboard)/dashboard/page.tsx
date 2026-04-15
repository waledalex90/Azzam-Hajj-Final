import { Card } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/constants/roles";

export default async function DashboardHomePage() {
  const { appUser } = await getSessionContext();

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">مرحبًا {appUser?.full_name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          الدور الحالي: {appUser ? ROLE_LABELS[appUser.role] : "غير معروف"}
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2">
        <Card>
          <h2 className="text-sm font-bold text-slate-900">التحضير (Attendance)</h2>
          <p className="mt-1 text-sm text-slate-600">
            يدعم هذا الإصدار التقسيم الصفحي من السيرفر ليستوعب +6000 عامل.
          </p>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-slate-900">المخالفات (Violations)</h2>
          <p className="mt-1 text-sm text-slate-600">
            شاشة المخالفات مبنية على النظام الجديد مع حفظ الأدلة والتاريخ.
          </p>
        </Card>
      </div>
    </section>
  );
}

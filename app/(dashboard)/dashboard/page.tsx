import { Card } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { getDashboardStats } from "@/lib/data/dashboard";

export default async function DashboardHomePage() {
  const { appUser } = await getSessionContext();
  const stats = await getDashboardStats();

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">مرحبًا {appUser?.full_name}</h1>
        <p className="mt-1 text-sm text-slate-600">
          الدور الحالي: {appUser ? ROLE_LABELS[appUser.role] : "غير معروف"}
        </p>
      </Card>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <h2 className="text-sm font-bold text-slate-900">حاضر اليوم</h2>
          <p className="mt-2 text-2xl font-extrabold status-present">{stats.presentToday}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-slate-900">غائب اليوم</h2>
          <p className="mt-2 text-2xl font-extrabold status-absent">{stats.absentToday}</p>
        </Card>
        <Card>
          <h2 className="text-sm font-bold text-slate-900">مخالفات اليوم</h2>
          <p className="mt-2 text-2xl font-extrabold text-amber-700">{stats.violationsToday}</p>
        </Card>
      </div>

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

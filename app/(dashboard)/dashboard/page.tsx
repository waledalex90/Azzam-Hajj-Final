import { Card } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/constants/roles";
import { getAdminDashboardData, getDashboardStats } from "@/lib/data/dashboard";

export default async function DashboardHomePage() {
  const { appUser } = await getSessionContext();
  const [attendanceStats, dashboardData] = await Promise.all([
    getDashboardStats(),
    getAdminDashboardData(),
  ]);

  const totalAttendance = attendanceStats.presentToday + attendanceStats.absentToday;
  const attendanceRate =
    totalAttendance > 0 ? Math.round((attendanceStats.presentToday / totalAttendance) * 100) : 0;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">الرئيسية</h1>
        <p className="mt-1 text-xs text-slate-500">
          الرئيسية / {appUser?.full_name ?? "المستخدم"} / {appUser ? ROLE_LABELS[appUser.role] : "غير معروف"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="bg-white">
          <div className="text-center">
            <p className="text-2xl text-blue-600">🏢</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.sites}</p>
            <p className="mt-1 text-xs text-slate-500">المواقع</p>
          </div>
        </Card>
        <Card className="bg-white">
          <div className="text-center">
            <p className="text-2xl text-emerald-600">👥</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.activeWorkers}</p>
            <p className="mt-1 text-xs text-slate-500">العمال النشطون</p>
          </div>
        </Card>
        <Card className="bg-white">
          <div className="text-center">
            <p className="text-2xl text-slate-500">🚫</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.inactiveWorkers}</p>
            <p className="mt-1 text-xs text-slate-500">العمال الموقوفون</p>
          </div>
        </Card>
        <Card className="bg-white">
          <div className="text-center">
            <p className="text-2xl text-amber-600">🦺</p>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.contractors}</p>
            <p className="mt-1 text-xs text-slate-500">المقاولون</p>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="min-h-[180px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">أكثر مواقع حضورًا</h2>
            <span className="text-xs text-slate-400">📍</span>
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">اختر موقعًا حضوريًا لعرض التفاصيل.</p>
        </Card>

        <Card className="min-h-[180px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">نسبة الحضور اليوم</h2>
            <span className="text-xs text-slate-400">🧭</span>
          </div>
          <div className="mt-6 flex items-end justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-lg font-extrabold text-emerald-700">{attendanceStats.presentToday}</p>
              <p className="text-xs text-slate-500">حاضر</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-red-700">{attendanceStats.absentToday}</p>
              <p className="text-xs text-slate-500">غائب</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-extrabold text-amber-700">{attendanceRate}%</p>
              <p className="text-xs text-slate-500">نسبة اليوم</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-3 xl:grid-cols-3">
        <Card className="min-h-[190px]">
          <h2 className="text-sm font-extrabold text-slate-900">تنبيهات انتهاء الإقامات</h2>
          <div className="mt-3 space-y-2 text-sm">
            {dashboardData.iqamaAlerts.length === 0 ? (
              <p className="text-slate-500">لا توجد إقامات منتهية قريبًا.</p>
            ) : (
              dashboardData.iqamaAlerts.map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">
                    {item.id_number} - انتهاء: {new Date(item.iqama_expiry).toLocaleDateString("ar-SA")} (
                    {Math.ceil(
                      (new Date(item.iqama_expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
                    )}{" "}
                    يوم)
                  </p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="min-h-[190px]">
          <h2 className="text-sm font-extrabold text-slate-900">طلبات التعديل المعلقة</h2>
          <div className="mt-3 space-y-2 text-sm">
            {dashboardData.pendingCorrections.length === 0 ? (
              <p className="text-slate-500">لا توجد طلبات.</p>
            ) : (
              dashboardData.pendingCorrections.map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                  <p className="font-bold text-slate-800">طلب #{item.id}</p>
                  <p className="text-xs text-slate-500">{item.reason || "بدون وصف"}</p>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="min-h-[190px]">
          <h2 className="text-sm font-extrabold text-slate-900">آخر العمال المضافين</h2>
          <div className="mt-3 space-y-2 text-sm">
            {dashboardData.latestWorkers.length === 0 ? (
              <p className="text-slate-500">لا توجد بيانات حديثة.</p>
            ) : (
              dashboardData.latestWorkers.map((item) => (
                <div key={item.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.id_number}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </section>
  );
}

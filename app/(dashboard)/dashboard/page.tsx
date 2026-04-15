import { Card } from "@/components/ui/card";
import { Bell, Building2, Compass, MapPin, ShieldAlert, TrendingUp, UserCheck2, UserMinus2, Users2 } from "lucide-react";
import Link from "next/link";
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
        <Link href="/sites">
        <Card className="bg-white transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
              <MapPin className="h-5 w-5" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.sites}</p>
            <p className="mt-1 text-xs text-slate-500">المواقع</p>
          </div>
        </Card>
        </Link>
        <Link href="/workers?tab=list">
        <Card className="bg-white transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Users2 className="h-5 w-5" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.activeWorkers}</p>
            <p className="mt-1 text-xs text-slate-500">العمال النشطون</p>
          </div>
        </Card>
        </Link>
        <Link href="/workers?tab=list&showStopped=1">
        <Card className="bg-white transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
              <UserMinus2 className="h-5 w-5" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.inactiveWorkers}</p>
            <p className="mt-1 text-xs text-slate-500">العمال الموقوفون</p>
          </div>
        </Card>
        </Link>
        <Link href="/contractors">
        <Card className="bg-white transition hover:-translate-y-0.5 hover:shadow-md cursor-pointer">
          <div className="text-center">
            <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="mt-2 text-3xl font-extrabold text-slate-800">{dashboardData.topStats.contractors}</p>
            <p className="mt-1 text-xs text-slate-500">المقاولون</p>
          </div>
        </Card>
        </Link>
      </div>

      <div className="grid gap-3 xl:grid-cols-2">
        <Card className="min-h-[180px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">أكثر مواقع حضورًا</h2>
            <MapPin className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">اختر موقعًا حضوريًا لعرض التفاصيل.</p>
        </Card>

        <Card className="min-h-[180px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">نسبة الحضور اليوم</h2>
            <Compass className="h-4 w-4 text-slate-400" />
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">تنبيهات انتهاء الإقامات</h2>
            <ShieldAlert className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {dashboardData.iqamaAlerts.length === 0 ? (
              <p className="text-slate-500">لا توجد إقامات منتهية قريبًا.</p>
            ) : (
              dashboardData.iqamaAlerts.map((item) => (
                <div key={item.id} className="rounded-2xl border border-slate-200/80 bg-slate-50 px-3 py-2">
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
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">طلبات التعديل المعلقة</h2>
            <Bell className="h-4 w-4 text-rose-500" />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {dashboardData.pendingCorrections.length === 0 ? (
              <p className="text-slate-500">لا توجد طلبات.</p>
            ) : (
              dashboardData.pendingCorrections.map((item) => (
                <Link
                  href="/corrections"
                  key={item.id}
                  className="block rounded-2xl border border-rose-100 bg-rose-50/50 px-3 py-2 transition hover:bg-rose-100/70"
                >
                  <p className="font-bold text-slate-800">طلب #{item.id}</p>
                  <p className="text-xs text-slate-500">{item.reason || "بدون وصف"}</p>
                </Link>
              ))
            )}
          </div>
        </Card>

        <Card className="min-h-[190px]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-extrabold text-slate-900">آخر العمال المضافين</h2>
            <UserCheck2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-3 space-y-2 text-sm">
            {dashboardData.latestWorkers.length === 0 ? (
              <p className="text-slate-500">لا توجد بيانات حديثة.</p>
            ) : (
              dashboardData.latestWorkers.map((item) => (
                <Link
                  href="/workers?tab=list"
                  key={item.id}
                  className="block rounded-2xl border border-emerald-100 bg-emerald-50/40 px-3 py-2 transition hover:bg-emerald-100/60"
                >
                  <p className="font-bold text-slate-800">{item.name}</p>
                  <p className="text-xs text-slate-500">{item.id_number}</p>
                </Link>
              ))
            )}
          </div>
        </Card>
      </div>

      <Card className="bg-gradient-to-l from-emerald-50 to-amber-50">
        <div className="flex items-center justify-between">
          <p className="text-sm font-extrabold text-slate-800">مؤشر الأداء اليومي</p>
          <TrendingUp className="h-4 w-4 text-emerald-700" />
        </div>
        <p className="mt-2 text-sm text-slate-600">معدل الحضور الحالي {attendanceRate}% مع أداء تشغيلي مستقر.</p>
      </Card>
    </section>
  );
}

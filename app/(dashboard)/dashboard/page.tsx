import { Card } from "@/components/ui/card";
import { Bell, Building2, Compass, MapPin, ShieldAlert, TrendingUp, Truck, UserCheck2, UserMinus2, Users2 } from "lucide-react";
import Link from "next/link";
import { DashboardDateFilter } from "@/components/dashboard/dashboard-date-filter";
import { canRespondAsHr, getAppUserSiteIds } from "@/lib/auth/transfer-access";
import { getSessionContext } from "@/lib/auth/session";
import { getAdminDashboardData, getDashboardStats } from "@/lib/data/dashboard";
import { getTransferAlertCounts } from "@/lib/data/transfer-requests";

type Props = { searchParams: Promise<{ date?: string }> };

export default async function DashboardHomePage({ searchParams }: Props) {
  const params = await searchParams;
  const filterDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);

  const { appUser } = await getSessionContext();
  const [attendanceStats, dashboardData] = await Promise.all([
    getDashboardStats(filterDate),
    getAdminDashboardData(filterDate),
  ]);

  const transferAlerts = appUser
    ? await getTransferAlertCounts({
        destinationSiteIds: await getAppUserSiteIds(appUser.id),
        isHr: canRespondAsHr(appUser),
      })
    : { destinationPending: 0, hrPending: 0 };
  const transferTotal = transferAlerts.destinationPending + transferAlerts.hrPending;

  const totalRegisteredToday =
    attendanceStats.presentToday + attendanceStats.absentToday + attendanceStats.halfToday;
  const attendanceRate =
    totalRegisteredToday > 0
      ? Math.round((attendanceStats.presentToday / totalRegisteredToday) * 100)
      : 0;

  return (
    <section className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">الرئيسية</h1>
        <p className="mt-1 text-xs text-slate-500">
          الرئيسية / {appUser?.full_name ?? "المستخدم"} / {appUser?.roleLabel ?? "غير معروف"}
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

      <Card className="border border-emerald-100 bg-emerald-50/40">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-extrabold text-slate-900">حضور — {filterDate}</h2>
          <div className="flex flex-wrap items-center gap-2">
            <DashboardDateFilter currentDate={filterDate} />
            <Compass className="h-4 w-4 text-emerald-600" />
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          إجمالي العمال النشطين:{" "}
          <span className="font-extrabold text-slate-900">{attendanceStats.totalActiveWorkers}</span> — متبقٍّ
          للتسجيل:{" "}
          <span className="font-extrabold text-amber-800">{attendanceStats.pendingToday}</span>
        </p>
        <div className="mt-4 flex flex-wrap items-end justify-center gap-6 text-sm sm:gap-10">
          <div className="text-center">
            <p className="text-xl font-extrabold text-emerald-700">{attendanceStats.presentToday}</p>
            <p className="text-xs text-slate-500">حاضر</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-red-700">{attendanceStats.absentToday}</p>
            <p className="text-xs text-slate-500">غائب</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-amber-700">{attendanceStats.halfToday}</p>
            <p className="text-xs text-slate-500">نصف يوم</p>
          </div>
          <div className="text-center">
            <p className="text-xl font-extrabold text-slate-800">{attendanceRate}%</p>
            <p className="text-xs text-slate-500">حاضر من المسجّل</p>
          </div>
        </div>
      </Card>

      {transferTotal > 0 && (
        <Link href="/transfers">
          <Card className="border-2 border-teal-400 bg-teal-50 shadow-sm transition hover:shadow-md">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <Truck className="h-8 w-8 shrink-0 text-teal-700" />
                <div>
                  <p className="text-base font-extrabold text-teal-950">
                    لديك ({transferTotal}) طلبات نقل معلقة
                  </p>
                  <p className="mt-0.5 text-xs text-slate-700">
                    {transferAlerts.destinationPending > 0
                      ? `${transferAlerts.destinationPending} بانتظار موافقة الوجهة`
                      : ""}
                    {transferAlerts.destinationPending > 0 && transferAlerts.hrPending > 0 ? " — " : ""}
                    {transferAlerts.hrPending > 0 ? `${transferAlerts.hrPending} بانتظار اعتماد الموارد` : ""}
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-teal-700 px-3 py-1.5 text-xs font-extrabold text-white">عرض الطلبات</span>
            </div>
          </Card>
        </Link>
      )}

      <Card className="min-h-[160px]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold text-slate-900">المواقع — حضور {filterDate}</h2>
          <MapPin className="h-4 w-4 text-slate-400" />
        </div>
        <div className="mt-3 max-h-[280px] space-y-2 overflow-y-auto text-sm">
          {dashboardData.siteAttendanceToday.length === 0 ? (
            <p className="text-slate-500">لا توجد مواقع أو بيانات.</p>
          ) : (
            dashboardData.siteAttendanceToday.map((row) => (
              <div
                key={row.siteId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
              >
                <span className="font-bold text-slate-800">{row.siteName}</span>
                <span className="text-xs text-slate-600">
                  إجمالي {row.totalWorkers} — معلّق{" "}
                  <span className="font-extrabold text-amber-800">{row.pending}</span> — حاضر {row.present} / غائب{" "}
                  {row.absent} / نصف {row.half}
                </span>
              </div>
            ))
          )}
        </div>
      </Card>

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
        <p className="mt-2 text-sm text-slate-600">
          مسجّل اليوم {totalRegisteredToday} من أصل {attendanceStats.totalActiveWorkers} — معدل الحاضر من المسجّل{" "}
          {attendanceRate}%.
        </p>
      </Card>
    </section>
  );
}

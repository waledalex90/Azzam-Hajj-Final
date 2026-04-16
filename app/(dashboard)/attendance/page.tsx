import Link from "next/link";
import { Card } from "@/components/ui/card";
import { AttendanceFilterToolbar } from "@/components/attendance/attendance-filter-toolbar";
import { AttendanceResetButton } from "@/components/attendance/attendance-reset-button";
import {
  getAllPendingPrepWorkers,
  getAttendanceChecksPage,
  getAttendanceDayStats,
  getAttendanceLatestStatusMap,
  getAttendancePrepTabStats,
  summarizeAttendanceChecksForRound,
  getContractorOptions,
  getSiteOptions,
  normalizeShiftRound,
} from "@/lib/data/attendance";
import { AttendancePrepWorkzone } from "@/components/attendance/attendance-prep-workzone";
import { AttendanceReviewTab } from "@/components/attendance/attendance-review-tab";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
type Props = {
  searchParams: Promise<{
    tab?: string;
    siteId?: string;
    contractorId?: string;
    date?: string;
    /** 1 = صباحي، 2 = مسائي */
    shift?: string;
  }>;
};

const FULL_LOAD = 50000;

export const dynamic = "force-dynamic";

export default async function AttendancePage({ searchParams }: Props) {
  const { appUser } = await getSessionContext();
  const canCorrection = Boolean(appUser && hasPermission(appUser, PERM.CORRECTION_REQUEST));
  const canResetAttendance = Boolean(
    appUser && (hasPermission(appUser, PERM.PREP) || hasPermission(appUser, PERM.APPROVAL)),
  );

  const params = await searchParams;
  const activeTab = params.tab === "review" ? "review" : "workers";
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const workDate =
    params.date && /^\d{4}-\d{2}-\d{2}$/.test(params.date)
      ? params.date
      : new Date().toISOString().slice(0, 10);

  const roundNo = normalizeShiftRound(params.shift);

  const [sites, contractors, dayStats] = await Promise.all([
    getSiteOptions(),
    getContractorOptions(),
    activeTab === "workers"
      ? getAttendancePrepTabStats(
          workDate,
          Number.isFinite(siteId) ? siteId : undefined,
          Number.isFinite(contractorId) ? contractorId : undefined,
          undefined,
          roundNo,
        )
      : getAttendanceDayStats(
          workDate,
          Number.isFinite(siteId) ? siteId : undefined,
          Number.isFinite(contractorId) ? contractorId : undefined,
          undefined,
        ),
  ]);

  const prepWorkers =
    activeTab === "workers"
      ? await getAllPendingPrepWorkers({
          siteId: Number.isFinite(siteId) ? siteId : undefined,
          contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
          search: undefined,
          workDate,
          roundNo,
        })
      : null;

  const initialStatusMap =
    activeTab === "workers" && prepWorkers
      ? await getAttendanceLatestStatusMap(
          workDate,
          prepWorkers.rows.map((item) => item.id),
          roundNo,
        )
      : {};

  const reviewedPage =
    activeTab === "review"
      ? await getAttendanceChecksPage({
          page: 1,
          pageSize: FULL_LOAD,
          workDate,
          siteId: Number.isFinite(siteId) ? siteId : undefined,
          search: undefined,
          roundNo,
        })
      : null;

  const reviewedRows = reviewedPage?.rows ?? [];
  const reviewRoundStats =
    activeTab === "review" ? summarizeAttendanceChecksForRound(reviewedRows) : null;

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">تسجيل الحضور والمراجعة</h1>
        <p className="mt-1 text-sm text-slate-600">
          تبويب «الموظفون والتحضير» للتسجيل فقط (حاضر / غائب / نصف يوم). تبويب «مراجعة تحضير اليوم» لمراجعة السجلات
          وطلب التعديل أو إعادة التحضير للعامل.
        </p>

        <div className="mt-3 flex items-center gap-2 border-b border-slate-200 text-sm">
          <Link
            href={`/attendance?tab=workers&date=${workDate}&shift=${roundNo}${params.siteId ? `&siteId=${params.siteId}` : ""}${params.contractorId ? `&contractorId=${params.contractorId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "workers"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            الموظفون والتحضير
          </Link>
          <Link
            href={`/attendance?tab=review&date=${workDate}&shift=${roundNo}${params.siteId ? `&siteId=${params.siteId}` : ""}${params.contractorId ? `&contractorId=${params.contractorId}` : ""}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold ${
              activeTab === "review"
                ? "bg-emerald-50 text-emerald-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            مراجعة تحضير اليوم
          </Link>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          {activeTab === "workers"
            ? "الوردية: صباحي/مسائي — جولة منفصلة لكل وردية. المسائي لا يعرض من حُضِّر صباحاً. بحث فوري تحت الجدول."
            : "نفس الوردية المختارة لعرض سجلات المراجعة والاعتماد المعلّق لهذه الجولة فقط."}
        </p>
        {activeTab === "workers" ? (
          <AttendanceFilterToolbar
            basePath="/attendance"
            tab="workers"
            workDate={workDate}
            roundNo={roundNo}
            siteId={params.siteId}
            contractorId={params.contractorId}
            sites={sites}
            contractors={contractors}
            showContractor
          />
        ) : (
          <AttendanceFilterToolbar
            basePath="/attendance"
            tab="review"
            workDate={workDate}
            roundNo={roundNo}
            siteId={params.siteId}
            contractors={contractors}
            sites={sites}
            showContractor={false}
          />
        )}
      </Card>

      {activeTab === "workers" ? (
        <AttendancePrepWorkzone
          key={`prep-${workDate}-${roundNo}-${params.siteId ?? ""}-${params.contractorId ?? ""}`}
          initialDayStats={dayStats}
          initialWorkers={prepWorkers?.rows ?? []}
          initialStatusMap={initialStatusMap}
          workDate={workDate}
          roundNo={roundNo}
        />
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <Card className="text-center">
              <p className="text-xs text-slate-500">معلّق اعتماد</p>
              <p className="mt-1 text-2xl font-extrabold text-slate-700">{reviewRoundStats?.pending ?? 0}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-500">حاضر</p>
              <p className="mt-1 text-2xl font-extrabold text-emerald-700">{reviewRoundStats?.present ?? 0}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-500">غائب</p>
              <p className="mt-1 text-2xl font-extrabold text-red-700">{reviewRoundStats?.absent ?? 0}</p>
            </Card>
            <Card className="text-center">
              <p className="text-xs text-slate-500">نصف يوم</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-700">{reviewRoundStats?.half ?? 0}</p>
            </Card>
          </div>
          <Card className="border-dashed border-slate-200 bg-white/80">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold text-slate-800">
                سجلات المحضّرة للمراجعة — {workDate} — {roundNo === 2 ? "مسائي" : "صباحي"}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {canResetAttendance ? (
                  <AttendanceResetButton workDate={workDate} roundNo={roundNo} siteId={params.siteId} />
                ) : null}
                <p className="rounded-lg bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                  إجمالي السجلات: {reviewedRows.length}
                </p>
              </div>
            </div>
          </Card>

          <AttendanceReviewTab
            key={`rev-${workDate}-${roundNo}-${params.siteId ?? ""}`}
            initialRows={reviewedRows}
            canCorrection={canCorrection}
            shiftLabel={roundNo === 2 ? "مسائي" : "صباحي"}
          />
        </>
      )}
    </section>
  );
}

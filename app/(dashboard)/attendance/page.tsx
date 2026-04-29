import { SpaLink } from "@/components/navigation/spa-link";
import { unstable_noStore as noStore } from "next/cache";
import { Card } from "@/components/ui/card";
import { AttendanceFilterToolbar } from "@/components/attendance/attendance-filter-toolbar";
import {
  getAllPendingPrepWorkers,
  getAttendanceChecksPage,
  getAttendanceDayStats,
  getAttendanceLatestStatusMap,
  getAttendanceLatestStatusMapForPrepMixed,
  getAttendancePrepTabStats,
  summarizeAttendanceChecksForRound,
  getContractorOptionsLive,
  getSiteOptionsLive,
} from "@/lib/data/attendance";
import { AttendancePrepWorkzone } from "@/components/attendance/attendance-prep-workzone";
import { AttendanceReviewTab } from "@/components/attendance/attendance-review-tab";
import { AttendanceRscRefreshLockProvider } from "@/components/attendance/attendance-rsc-refresh-lock";
import { AttendanceSyncBridge } from "@/components/attendance/attendance-sync-bridge";
import { TabPanelTransition } from "@/components/ui/tab-panel-transition";
import { requireAnyScreen } from "@/lib/auth/require-screen";
import { canRequestAttendanceCorrection, hasPermission } from "@/lib/auth/permissions";
import { resolveAllowedSiteIdsForSession } from "@/lib/auth/transfer-access";
import { PERM } from "@/lib/permissions/keys";
import type { AttendanceDayStats } from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";
import { parseAttendancePrepShiftParam } from "@/lib/utils/attendance-shift";
import { resolveWorkDateFromSearchParam } from "@/lib/utils/today";

const emptyStats: AttendanceDayStats = {
  total: 0,
  pending: 0,
  present: 0,
  absent: 0,
  half: 0,
};

type Props = {
  searchParams: Promise<{
    tab?: string;
    siteId?: string;
    contractorId?: string;
    date?: string;
    /** 0|all = كل الورديات في التحضير؛ 1 صباحي؛ 2 مسائي */
    shift?: string;
  }>;
};

const FULL_LOAD = 50000;

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
/** مهلة أطول لاستدعاءات RPC التحضير (دفعات متعددة). */
export const maxDuration = 120;

export default async function AttendancePage({ searchParams }: Props) {
  noStore();
  const appUser = await requireAnyScreen([PERM.VIEW_ATTENDANCE, PERM.EDIT_ATTENDANCE]);
  const allowedSiteIds = await resolveAllowedSiteIdsForSession(appUser);
  const canCorrection = canRequestAttendanceCorrection(appUser);
  /** اعتماد/طابور إداري: المراقب الفني؛ الميداني يرى نفس القائمة للاطلاع فقط (من نُقِل بعد تحضيره). */
  const canManageReviewQueue = hasPermission(appUser, PERM.APPROVE_ATTENDANCE);
  const canEditPrep = hasPermission(appUser, PERM.EDIT_ATTENDANCE);

  const params = await searchParams;
  const activeTab = params.tab === "review" ? "review" : "workers";
  let siteId = params.siteId ? Number(params.siteId) : undefined;
  if (allowedSiteIds !== undefined) {
    if (allowedSiteIds.length === 0) {
      siteId = undefined;
    } else if (!Number.isFinite(siteId) || (siteId !== undefined && !allowedSiteIds.includes(siteId))) {
      siteId = undefined;
    }
  }
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;
  const workDate = resolveWorkDateFromSearchParam(params.date);

  const prepShiftScope = parseAttendancePrepShiftParam(params.shift);
  /** تبويب المراجعة يحمّل جولة واحدة؛ مع «كل الورديات» في الرابط نعرض صباحي حتى يختار المستخدم مسائي من القائمة */
  const reviewRoundNo: 1 | 2 = prepShiftScope === "all" ? 1 : prepShiftScope;

  function attendanceQuery(tab: "workers" | "review") {
    const q = new URLSearchParams();
    q.set("tab", tab);
    if (workDate) q.set("date", workDate);
    const shiftStr =
      params.shift !== undefined && String(params.shift).trim() !== ""
        ? String(params.shift).trim()
        : "1";
    q.set("shift", shiftStr);
    if (params.siteId) q.set("siteId", params.siteId);
    if (params.contractorId) q.set("contractorId", params.contractorId);
    return q.toString();
  }

  let sites: Awaited<ReturnType<typeof getSiteOptionsLive>> = [];
  let contractors: Awaited<ReturnType<typeof getContractorOptionsLive>> = [];
  let dayStats: AttendanceDayStats = emptyStats;
  let prepWorkers: Awaited<ReturnType<typeof getAllPendingPrepWorkers>> | null = null;
  let initialStatusMap: Record<number, "present" | "absent" | "half"> = {};
  let reviewedRows: Awaited<ReturnType<typeof getAttendanceChecksPage>>["rows"] = [];
  let reviewRoundStats: ReturnType<typeof summarizeAttendanceChecksForRound> | null = null;

  try {
    [sites, contractors, dayStats] = await Promise.all([
      getSiteOptionsLive(),
      getContractorOptionsLive(),
      activeTab === "workers"
        ? getAttendancePrepTabStats(
            workDate,
            Number.isFinite(siteId) ? siteId : undefined,
            Number.isFinite(contractorId) ? contractorId : undefined,
            undefined,
            prepShiftScope,
            allowedSiteIds,
          )
        : getAttendanceDayStats(
            workDate,
            Number.isFinite(siteId) ? siteId : undefined,
            Number.isFinite(contractorId) ? contractorId : undefined,
            undefined,
            allowedSiteIds,
          ),
    ]);
  } catch {
    sites = [];
    contractors = [];
    dayStats = emptyStats;
  }

  if (activeTab === "workers") {
    try {
      prepWorkers = await getAllPendingPrepWorkers({
        siteId: Number.isFinite(siteId) ? siteId : undefined,
        allowedSiteIds,
        contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
        search: undefined,
        workDate,
        prepShiftScope,
      });
    } catch {
      prepWorkers = { rows: [], meta: buildPaginationMeta(0, 1, 1) };
    }
    try {
      initialStatusMap =
        prepWorkers.rows.length > 0
          ? prepShiftScope === "all"
            ? await getAttendanceLatestStatusMapForPrepMixed(workDate, prepWorkers.rows)
            : await getAttendanceLatestStatusMap(
                workDate,
                prepWorkers.rows.map((item) => item.id),
                prepShiftScope,
              )
          : {};
    } catch {
      initialStatusMap = {};
    }
  }

  if (activeTab === "review") {
    try {
      const reviewedPage = await getAttendanceChecksPage({
        page: 1,
        pageSize: FULL_LOAD,
        workDate,
        siteId: Number.isFinite(siteId) ? siteId : undefined,
        allowedSiteIds,
        search: undefined,
        roundNo: reviewRoundNo,
      });
      reviewedRows = reviewedPage?.rows ?? [];
      reviewRoundStats = summarizeAttendanceChecksForRound(reviewedRows);
    } catch {
      reviewedRows = [];
      reviewRoundStats = summarizeAttendanceChecksForRound([]);
    }
  }

  if (allowedSiteIds !== undefined) {
    sites = allowedSiteIds.length > 0 ? sites.filter((s) => allowedSiteIds.includes(s.id)) : [];
  }

  return (
    <AttendanceRscRefreshLockProvider>
      <section className="space-y-4">
        <AttendanceSyncBridge />
        <Card>
        <h1 className="text-lg font-extrabold text-slate-900">تسجيل الحضور والمراجعة</h1>
        <p className="mt-1 text-sm text-slate-600">
          {canManageReviewQueue ? (
            <>
              «الموظفون والتحضير» للتسجيل. «مراجعة تحضير اليوم» لاعتماد أو رفض السجلات وطلب التعديل عند الحاجة.
            </>
          ) : (
            <>
              <span className="font-extrabold text-slate-800">تحضيرك في التبويب الأول نهائي من ناحية عملك الميداني.</span>{" "}
              السجل يُنقل تلقائياً إلى «مراجعة تحضير اليوم» لترى من تم تحضيره (للاطلاع عند أي استفسار)؛{" "}
              <span className="font-extrabold text-slate-800">الاعتماد الإداري</span> من المراقب الفني وليس منك.
            </>
          )}
        </p>

        <div className="mt-3 flex items-center gap-2 border-b border-slate-200 text-sm">
          <SpaLink
            href={`/attendance?${attendanceQuery("workers")}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold transition-colors ${
              activeTab === "workers"
                ? "bg-[#14532d] text-white shadow-sm ring-2 ring-[#14532d]/25"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            الموظفون والتحضير
          </SpaLink>
          <SpaLink
            href={`/attendance?${attendanceQuery("review")}`}
            className={`rounded-t-xl px-3 py-2 font-extrabold transition-colors ${
              activeTab === "review"
                ? "bg-[#14532d] text-white shadow-sm ring-2 ring-[#14532d]/25"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            مراجعة تحضير اليوم
          </SpaLink>
        </div>

        <p className="mt-2 text-xs text-slate-600">
          {activeTab === "workers"
            ? "الوردية: صباحي أو مسائي أو «كل الورديات» (التسجيل يتم في وردية كل عامل تلقائياً). بحث فوري تحت الجدول."
            : canManageReviewQueue
              ? "نفس الوردية المختارة لعرض سجلات المراجعة والاعتماد المعلّق لهذه الجولة."
              : "عرض السجلات المُرحَّلة لهذا اليوم والوردية — للاطلاع على من تم تحضيره؛ الاعتماد من المراقب الفني."}
        </p>
        {activeTab === "workers" ? (
          <AttendanceFilterToolbar
            basePath="/attendance"
            tab="workers"
            workDate={workDate}
            prepShiftScope={prepShiftScope}
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
            prepShiftScope={prepShiftScope}
            siteId={params.siteId}
            contractorId={params.contractorId}
            contractors={contractors}
            sites={sites}
            showContractor
          />
        )}
      </Card>

      <TabPanelTransition key={activeTab}>
        {activeTab === "workers" ? (
          <AttendancePrepWorkzone
            key={`prep-${workDate}-${prepShiftScope}-${params.siteId ?? ""}-${params.contractorId ?? ""}`}
            initialDayStats={dayStats}
            initialWorkers={prepWorkers?.rows ?? []}
            initialStatusMap={initialStatusMap}
            workDate={workDate}
            prepShiftScope={prepShiftScope}
            siteId={params.siteId}
            contractorId={params.contractorId}
            readOnlyPrep={!canEditPrep}
          />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
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
            </div>
            <Card className="border-dashed border-slate-200 bg-white/80">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-extrabold text-slate-800">
                  سجلات المحضّرة للمراجعة — {workDate} —{" "}
                  {prepShiftScope === "all"
                    ? `صباحي (عرض المراجعة — اختر «مسائي» من القائمة لمراجعة المسائي)`
                    : reviewRoundNo === 2
                      ? "مسائي"
                      : "صباحي"}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="rounded-lg bg-slate-50 px-3 py-1 text-xs font-bold text-slate-600">
                    إجمالي السجلات: {reviewedRows.length}
                  </p>
                </div>
              </div>
            </Card>

            <AttendanceReviewTab
              key={`rev-${workDate}-${reviewRoundNo}-${params.siteId ?? ""}`}
              initialRows={reviewedRows}
              canCorrection={canCorrection}
              readOnlyReview={!canManageReviewQueue}
              shiftLabel={reviewRoundNo === 2 ? "مسائي" : "صباحي"}
            />
          </>
        )}
      </TabPanelTransition>
      </section>
    </AttendanceRscRefreshLockProvider>
  );
}

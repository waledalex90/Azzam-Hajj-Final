"use client";

import { useDeferredValue, useEffect, useMemo, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { revalidateAttendancePageCache } from "@/app/(dashboard)/attendance/actions";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { Card } from "@/components/ui/card";
import { matchesClientSearch } from "@/lib/utils/client-search";
import { workerHasSiteForPrep } from "@/lib/utils/worker-prep-eligibility";
import { attendancePrepShiftToQuery, type PrepShiftScope } from "@/lib/utils/attendance-shift";
import type { AttendanceDayStats, WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";
type PrepSubmitStatus = "present" | "absent";

type Props = {
  initialDayStats: AttendanceDayStats;
  initialWorkers: WorkerRow[];
  initialStatusMap: Record<number, AttendanceStatus | undefined>;
  pendingTotal: number;
  workDate: string;
  prepShiftScope: PrepShiftScope;
  siteId?: string;
  contractorId?: string;
  searchQuery?: string;
  readOnlyPrep?: boolean;
};

function applyPrepToStats(
  prev: AttendanceDayStats,
  count: number,
  status: PrepSubmitStatus,
): AttendanceDayStats {
  return {
    ...prev,
    pending: Math.max(0, prev.pending - count),
    present: status === "present" ? prev.present + count : prev.present,
    absent: status === "absent" ? prev.absent + count : prev.absent,
    half: prev.half,
  };
}

export function AttendancePrepWorkzone({
  initialDayStats,
  initialWorkers,
  initialStatusMap,
  pendingTotal,
  workDate,
  prepShiftScope,
  siteId,
  contractorId,
  searchQuery = "",
  readOnlyPrep = false,
}: Props) {
  const shiftQs = attendancePrepShiftToQuery(prepShiftScope);
  const singleRoundForTable = prepShiftScope === "all" ? 1 : prepShiftScope;
  const router = useRouter();
  const [dayStats, setDayStats] = useState({ ...initialDayStats, pending: pendingTotal });
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState(searchQuery);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setDayStats({ ...initialDayStats, pending: pendingTotal });
  }, [initialDayStats, pendingTotal]);

  useEffect(() => {
    setWorkers(initialWorkers);
  }, [initialWorkers]);

  const filteredRows = useMemo(() => {
    const s = deferredSearch.trim();
    if (!s) return workers;
    return workers.filter((w) => matchesClientSearch(w.name, w.id_number, s, w.employee_code));
  }, [workers, deferredSearch]);

  const scopeIds = useMemo(() => workers.map((w) => w.id), [workers]);
  const workersWithoutSiteCount = useMemo(
    () => workers.filter((w) => !workerHasSiteForPrep(w)).length,
    [workers],
  );

  /** بعد التحضير: الانتقال لتبويب المراجعة لرؤية من نُقِل للطابور (ميداني = اطلاع، فني = اعتماد). */
  const goToReviewTab = useCallback(() => {
    const qs = new URLSearchParams();
    qs.set("tab", "review");
    qs.set("date", workDate);
    qs.set("shift", shiftQs);
    if (siteId) qs.set("siteId", siteId);
    if (contractorId) qs.set("contractorId", contractorId);
    window.location.assign(`/attendance?${qs.toString()}`);
  }, [workDate, shiftQs, siteId, contractorId]);

  const onPrepDone = useCallback(
    (ids: number[], status: PrepSubmitStatus) => {
      const set = new Set(ids);
      let becameEmpty = false;
      let pendingLeft = 0;
      flushSync(() => {
        setWorkers((prev) => {
          const next = prev.filter((w) => !set.has(w.id));
          if (next.length === 0) becameEmpty = true;
          return next;
        });
        setDayStats((prev) => {
          const next = applyPrepToStats(prev, ids.length, status);
          pendingLeft = next.pending;
          return next;
        });
      });
      if (pendingLeft <= 0) {
        queueMicrotask(() => goToReviewTab());
      } else if (becameEmpty) {
        queueMicrotask(() => router.refresh());
      }
    },
    [goToReviewTab, router],
  );

  const onResetAll = useCallback(() => {
    setSearch("");
    const qs = new URLSearchParams();
    qs.set("tab", "workers");
    qs.set("date", workDate);
    qs.set("shift", shiftQs);
    if (siteId) qs.set("siteId", siteId);
    if (contractorId) qs.set("contractorId", contractorId);
    router.push(`/attendance?${qs.toString()}`);
  }, [router, workDate, shiftQs, siteId, contractorId]);

  const onHardRefresh = useCallback(async () => {
    await revalidateAttendancePageCache();
    router.refresh();
  }, [router]);

  const allDone = dayStats.pending === 0 && workers.length === 0;

  const displayedPendingCount = dayStats.pending;

  const statsBlock = (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="text-center">
        <p className="text-xs text-slate-500">معلّق</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-700">{displayedPendingCount}</p>
      </Card>
      <Card className="text-center">
        <p className="text-xs text-slate-500">حاضر</p>
        <p className="mt-1 text-2xl font-extrabold text-emerald-700">{dayStats.present}</p>
      </Card>
      <Card className="text-center">
        <p className="text-xs text-slate-500">غائب</p>
        <p className="mt-1 text-2xl font-extrabold text-red-700">{dayStats.absent}</p>
      </Card>
    </div>
  );

  if (allDone) {
    return (
      <>
        {statsBlock}
        <Card className="border border-dashed border-emerald-300 bg-emerald-50 px-6 py-10 text-center">
          <p className="text-lg font-bold text-emerald-900">لا يوجد معلّقون للتحضير</p>
          <p className="mt-2 text-sm text-emerald-800">
            كل العمال ضمن الفلتر لديهم سجل لهذا اليوم. يمكنك فتح «مراجعة تحضير اليوم» لرؤية من ورد في الطابور.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      {workersWithoutSiteCount > 0 ? (
        <Card className="border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-950">
          <p className="font-extrabold">
            تنبيه: {workersWithoutSiteCount} عامل بلا «موقع حالي» — لن يُحفظ تحضيرهم حتى تعيّن الموقع من شاشة «العمال»
          </p>
          <p className="mt-1 text-xs text-rose-900">
            للمراقب الميداني: إن كان الموقع مظبوطاً للعامل فتأكد أن نفس الموقع مربوط بحسابك في إعدادات المستخدم.
          </p>
        </Card>
      ) : null}
      {statsBlock}

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <form className="flex flex-wrap items-end gap-2" action="/attendance" method="get">
          <input type="hidden" name="tab" value="workers" />
          <input type="hidden" name="date" value={workDate} />
          <input type="hidden" name="shift" value={shiftQs} />
          {siteId ? <input type="hidden" name="siteId" value={siteId} /> : null}
          {contractorId ? <input type="hidden" name="contractorId" value={contractorId} /> : null}
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-bold text-slate-700">بحث في المعلّقين</label>
            <input
              type="text"
              name="q"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم أو رقم هوية أو كود…"
              className="mt-1 w-full max-w-md rounded-xl border border-slate-300 px-3 py-2 text-sm"
              autoComplete="off"
            />
          </div>
          <button type="submit" className="rounded-xl bg-[#0B1730] px-3 py-2 text-xs font-bold text-white">
            بحث
          </button>
          <button
            type="button"
            onClick={onResetAll}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          >
            عرض الكل / إعادة ضبط
          </button>
          <button
            type="button"
            onClick={() => void onHardRefresh()}
            className="rounded-xl bg-slate-700 px-3 py-2 text-xs font-bold text-white"
          >
            تحديث
          </button>
        </form>
        <p className="mt-1 text-xs text-slate-500">
          الصفحة تعرض {filteredRows.length} من أصل {dayStats.pending} معلّق. الإجمالي لا يعتمد على الصفوف المرسومة.
        </p>
      </div>

      <AttendanceWorkersTable
        rows={filteredRows}
        workDate={workDate}
        roundNo={singleRoundForTable}
        usePerWorkerRound={prepShiftScope === "all"}
        initialStatusMap={initialStatusMap}
        filteredWorkerIds={scopeIds}
        filteredTotalRows={dayStats.pending}
        skipServerRefresh
        onAttendanceChunkSaved={onPrepDone}
        readOnly={readOnlyPrep}
        filterContext={{
          siteId: siteId ? Number(siteId) : undefined,
          contractorId: contractorId ? Number(contractorId) : undefined,
          search: searchQuery,
          prepShiftScope,
        }}
      />
    </>
  );
}

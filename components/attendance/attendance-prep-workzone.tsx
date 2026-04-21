"use client";

import { useDeferredValue, useEffect, useMemo, useState, useCallback } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { revalidateAttendancePageCache } from "@/app/(dashboard)/attendance/actions";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { Card } from "@/components/ui/card";
import { matchesClientSearch } from "@/lib/utils/client-search";
import { workerHasSiteForPrep } from "@/lib/utils/worker-prep-eligibility";
import type { AttendanceDayStats, WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";
type PrepSubmitStatus = "present" | "absent";

type Props = {
  initialDayStats: AttendanceDayStats;
  initialWorkers: WorkerRow[];
  initialStatusMap: Record<number, AttendanceStatus | undefined>;
  workDate: string;
  /** 1 صباحي، 2 مسائي */
  roundNo: number;
  siteId?: string;
  contractorId?: string;
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
  workDate,
  roundNo,
  siteId,
  contractorId,
}: Props) {
  const router = useRouter();
  const [dayStats, setDayStats] = useState(initialDayStats);
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    setDayStats(initialDayStats);
  }, [initialDayStats]);

  useEffect(() => {
    setWorkers(initialWorkers);
  }, [initialWorkers]);

  const filteredRows = useMemo(() => {
    const s = deferredSearch.trim();
    if (!s) return workers;
    return workers.filter((w) => matchesClientSearch(w.name, w.id_number, s));
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
    qs.set("shift", String(roundNo));
    if (siteId) qs.set("siteId", siteId);
    if (contractorId) qs.set("contractorId", contractorId);
    window.location.assign(`/attendance?${qs.toString()}`);
  }, [workDate, roundNo, siteId, contractorId]);

  const onPrepDone = useCallback(
    (ids: number[], status: PrepSubmitStatus) => {
      const set = new Set(ids);
      let becameEmpty = false;
      flushSync(() => {
        setWorkers((prev) => {
          const next = prev.filter((w) => !set.has(w.id));
          if (next.length === 0) becameEmpty = true;
          return next;
        });
        setDayStats((prev) => applyPrepToStats(prev, ids.length, status));
      });
      if (becameEmpty) {
        queueMicrotask(() => goToReviewTab());
      }
    },
    [goToReviewTab],
  );

  const onResetAll = useCallback(() => {
    setSearch("");
    router.push(`/attendance?tab=workers&date=${encodeURIComponent(workDate)}&shift=${roundNo}`);
  }, [router, workDate, roundNo]);

  const onHardRefresh = useCallback(async () => {
    await revalidateAttendancePageCache();
    router.refresh();
  }, [router]);

  const allDone = workers.length === 0;

  const statsBlock = (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="text-center">
        <p className="text-xs text-slate-500">معلّق</p>
        <p className="mt-1 text-2xl font-extrabold text-slate-700">{dayStats.pending}</p>
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

      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-bold text-slate-700">بحث فوري (كل القائمة)</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم أو رقم هوية…"
              className="mt-1 w-full max-w-md border border-slate-300 px-2 py-1.5 text-sm"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={onResetAll}
            className="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
          >
            عرض الكل / إعادة ضبط
          </button>
          <button
            type="button"
            onClick={() => void onHardRefresh()}
            className="rounded bg-slate-700 px-3 py-2 text-xs font-bold text-white"
          >
            تحديث
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          يظهر {filteredRows.length} من أصل {workers.length} معلّق. كل من تُحضّره يختفي من هنا ويظهر في «مراجعة تحضير
          اليوم»؛ عندما لا يبقى معلّق في هذا النطاق يُفتح التبويب الثاني تلقائياً (أو افتحه يدوياً متى شئت).
        </p>
      </div>

      <AttendanceWorkersTable
        rows={filteredRows}
        workDate={workDate}
        roundNo={roundNo}
        initialStatusMap={initialStatusMap}
        filteredWorkerIds={scopeIds}
        filteredTotalRows={scopeIds.length}
        skipServerRefresh
        onAttendanceChunkSaved={onPrepDone}
      />
    </>
  );
}

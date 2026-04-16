"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { Card } from "@/components/ui/card";
import type { AttendanceDayStats, WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

type Props = {
  initialDayStats: AttendanceDayStats;
  initialWorkers: WorkerRow[];
  initialStatusMap: Record<number, AttendanceStatus | undefined>;
  workDate: string;
};

function applyPrepToStats(
  prev: AttendanceDayStats,
  count: number,
  status: AttendanceStatus,
): AttendanceDayStats {
  return {
    ...prev,
    pending: Math.max(0, prev.pending - count),
    present: status === "present" ? prev.present + count : prev.present,
    absent: status === "absent" ? prev.absent + count : prev.absent,
    half: status === "half" ? prev.half + count : prev.half,
  };
}

export function AttendancePrepWorkzone({
  initialDayStats,
  initialWorkers,
  initialStatusMap,
  workDate,
}: Props) {
  const [dayStats, setDayStats] = useState(initialDayStats);
  const [workers, setWorkers] = useState(initialWorkers);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setDayStats(initialDayStats);
  }, [initialDayStats]);

  useEffect(() => {
    setWorkers(initialWorkers);
  }, [initialWorkers]);

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return workers;
    return workers.filter(
      (w) => w.name.toLowerCase().includes(s) || String(w.id_number).toLowerCase().includes(s),
    );
  }, [workers, search]);

  const scopeIds = useMemo(() => workers.map((w) => w.id), [workers]);

  const onPrepDone = useCallback((ids: number[], status: AttendanceStatus) => {
    const set = new Set(ids);
    setWorkers((prev) => prev.filter((w) => !set.has(w.id)));
    setDayStats((prev) => applyPrepToStats(prev, ids.length, status));
  }, []);

  const allDone = workers.length === 0;

  const statsBlock = (
    <div className="grid gap-3 sm:grid-cols-4">
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
      <Card className="text-center">
        <p className="text-xs text-slate-500">نصف يوم</p>
        <p className="mt-1 text-2xl font-extrabold text-amber-700">{dayStats.half}</p>
      </Card>
    </div>
  );

  if (allDone) {
    return (
      <>
        {statsBlock}
        <Card className="border border-dashed border-emerald-300 bg-emerald-50 px-6 py-10 text-center">
          <p className="text-lg font-bold text-emerald-900">لا يوجد معلّقون للتحضير</p>
          <p className="mt-2 text-sm text-emerald-800">كل العمال ضمن الفلتر لديهم سجل لهذا اليوم.</p>
        </Card>
      </>
    );
  }

  return (
    <>
      {statsBlock}

      <div className="rounded border border-slate-200 bg-white p-3">
        <label className="block text-xs font-bold text-slate-700">بحث فوري (كل القائمة)</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="اسم أو رقم هوية…"
          className="mt-1 w-full max-w-md border border-slate-300 px-2 py-1.5 text-sm"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-500">
          يظهر {filteredRows.length} من أصل {workers.length} معلّق
        </p>
      </div>

      <AttendanceWorkersTable
        rows={filteredRows}
        workDate={workDate}
        initialStatusMap={initialStatusMap}
        filteredWorkerIds={scopeIds}
        filteredTotalRows={scopeIds.length}
        skipServerRefresh
        onAttendanceChunkSaved={onPrepDone}
      />
    </>
  );
}

"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { Card } from "@/components/ui/card";
import type { AttendanceDayStats, WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

function storageKey(
  workDate: string,
  siteId?: string,
  contractorId?: string,
  q?: string,
) {
  return `attendance:hidden:${workDate}:${siteId ?? ""}:${contractorId ?? ""}:${q ?? ""}`;
}

function readHiddenSet(key: string): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0));
  } catch {
    return new Set();
  }
}

function writeHiddenSet(key: string, ids: Set<number>) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(key, JSON.stringify([...ids]));
}

function applyStatsDelta(
  prev: AttendanceDayStats,
  old: AttendanceStatus | undefined,
  next: AttendanceStatus,
): AttendanceDayStats {
  if (old === next) return prev;
  const out = { ...prev };
  const dec = (k: keyof Pick<AttendanceDayStats, "pending" | "present" | "absent" | "half">) => {
    out[k] = Math.max(0, out[k] - 1);
  };
  const inc = (k: keyof Pick<AttendanceDayStats, "pending" | "present" | "absent" | "half">) => {
    out[k] = out[k] + 1;
  };
  if (old === undefined) dec("pending");
  else if (old === "present") dec("present");
  else if (old === "absent") dec("absent");
  else if (old === "half") dec("half");
  if (next === "present") inc("present");
  else if (next === "absent") inc("absent");
  else if (next === "half") inc("half");
  return out;
}

type Props = {
  initialDayStats: AttendanceDayStats;
  serverRows: WorkerRow[];
  workDate: string;
  initialStatusMap: Record<number, AttendanceStatus | undefined>;
  filteredWorkerIds: number[];
  filteredTotalRows: number;
  siteId?: string;
  contractorId?: string;
  q?: string;
  pagination: React.ReactNode;
};

export function AttendanceWorkzone({
  initialDayStats,
  serverRows,
  workDate,
  initialStatusMap,
  filteredWorkerIds,
  filteredTotalRows,
  siteId,
  contractorId,
  q,
  pagination,
}: Props) {
  const router = useRouter();
  const key = useMemo(
    () => storageKey(workDate, siteId, contractorId, q),
    [workDate, siteId, contractorId, q],
  );
  const [hidden, setHidden] = useState<Set<number>>(() => new Set());
  const [dayStats, setDayStats] = useState(initialDayStats);
  const initialStatusMapRef = useRef(initialStatusMap);
  initialStatusMapRef.current = initialStatusMap;

  useEffect(() => {
    setDayStats(initialDayStats);
  }, [initialDayStats]);

  useLayoutEffect(() => {
    setHidden(readHiddenSet(key));
  }, [key]);

  const navigateToReview = useCallback(() => {
    const qs = new URLSearchParams();
    qs.set("tab", "review");
    qs.set("date", workDate);
    if (siteId) qs.set("siteId", siteId);
    const qTrim = q?.trim();
    if (qTrim) qs.set("q", qTrim);
    router.replace(`/attendance?${qs.toString()}`);
    router.refresh();
  }, [router, workDate, siteId, q]);

  const onAttendanceChunkSaved = useCallback(
    (workerIds: number[], status: AttendanceStatus) => {
      setDayStats((prev) => {
        let s = prev;
        for (const id of workerIds) {
          const old = initialStatusMapRef.current[id];
          s = applyStatsDelta(s, old, status);
        }
        return s;
      });
      setHidden((prev) => {
        const next = new Set(prev);
        workerIds.forEach((id) => next.add(id));
        writeHiddenSet(key, next);
        return next;
      });
    },
    [key],
  );

  const onAttendanceSessionComplete = useCallback(() => {
    navigateToReview();
  }, [navigateToReview]);

  const visibleRows = useMemo(
    () => serverRows.filter((r) => !hidden.has(r.id)),
    [serverRows, hidden],
  );

  const effectiveFilteredIds = useMemo(() => {
    if (filteredWorkerIds.length > 0) {
      return Array.from(new Set(filteredWorkerIds.filter((id) => !hidden.has(id))));
    }
    return visibleRows.map((r) => r.id);
  }, [filteredWorkerIds, visibleRows, hidden]);

  const remainingInScope = Math.max(0, filteredTotalRows - hidden.size);
  const allWorkersScopedDone = filteredTotalRows > 0 && hidden.size >= filteredTotalRows;

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

  if (allWorkersScopedDone) {
    return (
      <>
        {statsBlock}
        <Card className="border-dashed border-emerald-200 bg-emerald-50/60 px-6 py-12 text-center">
          <p className="text-lg font-extrabold text-emerald-900">تم تحضير جميع العمال</p>
          <p className="mt-2 text-sm text-emerald-800/90">
            لا يوجد موظفون متبقّون ضمن نتائج الفلترة الحالية لهذا اليوم.
          </p>
        </Card>
      </>
    );
  }

  return (
    <>
      {statsBlock}

      <AttendanceWorkersTable
        rows={visibleRows}
        workDate={workDate}
        initialStatusMap={initialStatusMap}
        filteredWorkerIds={effectiveFilteredIds}
        filteredTotalRows={remainingInScope}
        onAttendanceChunkSaved={onAttendanceChunkSaved}
        onAttendanceSessionComplete={onAttendanceSessionComplete}
        suppressEmptyMessage={serverRows.length > 0 && visibleRows.length === 0}
      />

      {visibleRows.length === 0 && serverRows.length > 0 && (
        <Card className="border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-700">
          تم تحضير جميع موظفي هذه الصفحة. انتقل للصفحة التالية إن وُجدت، أو راجع التبويب «مراجعة تحضير اليوم».
        </Card>
      )}

      {pagination}
    </>
  );
}

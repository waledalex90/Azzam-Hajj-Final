"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { Card } from "@/components/ui/card";
import type { AttendanceDayStats, WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

type Props = {
  initialDayStats: AttendanceDayStats;
  serverRows: WorkerRow[];
  workDate: string;
  initialStatusMap: Record<number, AttendanceStatus | undefined>;
  filteredWorkerIds: number[];
  filteredTotalRows: number;
  siteId?: string;
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
  q,
  pagination,
}: Props) {
  const router = useRouter();
  const [dayStats, setDayStats] = useState(initialDayStats);

  useEffect(() => {
    setDayStats(initialDayStats);
  }, [initialDayStats]);

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

  const onAttendanceChunkSaved = useCallback(() => {
    router.refresh();
  }, [router]);

  const onAttendanceSessionComplete = useCallback(() => {
    navigateToReview();
  }, [navigateToReview]);

  const allWorkersScopedDone = filteredTotalRows === 0;

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
        rows={serverRows}
        workDate={workDate}
        initialStatusMap={initialStatusMap}
        filteredWorkerIds={filteredWorkerIds}
        filteredTotalRows={filteredTotalRows}
        onAttendanceChunkSaved={onAttendanceChunkSaved}
        onAttendanceSessionComplete={onAttendanceSessionComplete}
        suppressEmptyMessage={false}
      />

      {pagination}
    </>
  );
}

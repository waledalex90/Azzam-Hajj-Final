"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { revalidateAttendancePageCache } from "@/app/(dashboard)/attendance/actions";
import { ApprovalQueueTable } from "@/components/approval/approval-queue-table";
import { matchesClientSearch } from "@/lib/utils/client-search";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Props = {
  initialRows: AttendanceCheckRow[];
  totalPendingFiltered: number;
  workDate: string;
  siteId?: string;
  roundNo: number;
};

export function ApprovalPendingShell({
  initialRows,
  totalPendingFiltered,
  workDate,
  siteId,
  roundNo,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filteredRows = useMemo(() => {
    const s = deferredSearch.trim();
    if (!s) return initialRows;
    return initialRows.filter((row) =>
      matchesClientSearch(row.workers?.name, row.workers?.id_number, s),
    );
  }, [initialRows, deferredSearch]);

  const onReset = useCallback(() => {
    setSearch("");
    router.push(`/approval?tab=pending&date=${encodeURIComponent(workDate)}&shift=${roundNo}`);
  }, [router, workDate, roundNo]);

  const onHardRefresh = useCallback(async () => {
    await revalidateAttendancePageCache();
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-bold text-slate-700">بحث فوري في المعلّقين</label>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم أو هوية…"
              className="mt-1 w-full max-w-md border border-slate-300 px-2 py-1.5 text-sm"
              autoComplete="off"
            />
          </div>
          <button
            type="button"
            onClick={onReset}
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
          يظهر {filteredRows.length} من أصل {initialRows.length} سجل
        </p>
      </div>
      <ApprovalQueueTable
        rows={filteredRows}
        totalPendingFiltered={totalPendingFiltered}
        workDate={workDate}
        siteId={siteId}
        roundNo={roundNo}
        q={undefined}
      />
    </div>
  );
}

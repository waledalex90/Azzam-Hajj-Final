"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { revalidateAttendancePageCache } from "@/app/(dashboard)/attendance/actions";
import { ApprovalFilterStats } from "@/components/approval/approval-filter-stats";
import { ApprovalQueueTable } from "@/components/approval/approval-queue-table";
import { matchesClientSearch } from "@/lib/utils/client-search";
import type { AttendanceCheckRow } from "@/lib/types/db";

export type ApprovalShellStats = { pending: number; confirmed: number; total: number };

type Props = {
  initialRows: AttendanceCheckRow[];
  initialStats: ApprovalShellStats;
  totalPendingFiltered: number;
  workDate: string;
  siteId?: string;
  contractorId?: string;
  roundNo: number;
  canCorrection: boolean;
};

export function ApprovalPendingShell({
  initialRows,
  initialStats,
  totalPendingFiltered,
  workDate,
  siteId,
  contractorId,
  roundNo,
  canCorrection,
}: Props) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [baseRows, setBaseRows] = useState(initialRows);
  const [stats, setStats] = useState(initialStats);

  const filteredRows = useMemo(() => {
    const s = deferredSearch.trim();
    if (!s) return baseRows;
    return baseRows.filter((row) =>
      matchesClientSearch(row.workers?.name, row.workers?.id_number, s),
    );
  }, [baseRows, deferredSearch]);

  const onChunkApproved = useCallback((checkIds: number[]) => {
    const n = checkIds.length;
    if (n === 0) return;
    setBaseRows((prev) => prev.filter((r) => !checkIds.includes(r.id)));
    setStats((s) => ({
      pending: Math.max(0, s.pending - n),
      confirmed: s.confirmed + n,
      total: s.total,
    }));
  }, []);

  const onReset = useCallback(() => {
    setSearch("");
    const q = new URLSearchParams();
    q.set("tab", "pending");
    q.set("date", workDate);
    q.set("shift", String(roundNo));
    router.push(`/approval?${q.toString()}`);
  }, [router, workDate, roundNo]);

  const onHardRefresh = useCallback(async () => {
    await revalidateAttendancePageCache();
    router.refresh();
  }, [router]);

  return (
    <div className="space-y-3">
      <ApprovalFilterStats pending={stats.pending} confirmed={stats.confirmed} total={stats.total} />

      <div className="rounded border border-slate-200 bg-white p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[200px] flex-1">
            <label className="block text-xs font-bold text-slate-700">بحث فوري (اسم أو هوية)</label>
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
          يظهر {filteredRows.length} من أصل {baseRows.length} سجلًا (نطاق الفلاتر أعلاه)
        </p>
      </div>
      <ApprovalQueueTable
        rows={filteredRows}
        totalPendingFiltered={totalPendingFiltered}
        workDate={workDate}
        siteId={siteId}
        contractorId={contractorId}
        roundNo={roundNo}
        canCorrection={canCorrection}
        onChunkApproved={onChunkApproved}
      />
    </div>
  );
}

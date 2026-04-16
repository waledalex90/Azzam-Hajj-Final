"use client";

import { useMemo, useState } from "react";

import { ApprovalQueueTable } from "@/components/approval/approval-queue-table";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Props = {
  initialRows: AttendanceCheckRow[];
  totalPendingFiltered: number;
  workDate: string;
  siteId?: string;
};

export function ApprovalPendingShell({
  initialRows,
  totalPendingFiltered,
  workDate,
  siteId,
}: Props) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return initialRows;
    return initialRows.filter((row) => {
      const name = row.workers?.name?.toLowerCase() ?? "";
      const idn = row.workers?.id_number?.toLowerCase() ?? "";
      return name.includes(s) || idn.includes(s);
    });
  }, [initialRows, search]);

  return (
    <div className="space-y-3">
      <div className="rounded border border-slate-200 bg-white p-3">
        <label className="block text-xs font-bold text-slate-700">بحث فوري في المعلّقين</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="اسم أو هوية…"
          className="mt-1 w-full max-w-md border border-slate-300 px-2 py-1.5 text-sm"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-500">
          يظهر {filteredRows.length} من أصل {initialRows.length} سجل
        </p>
      </div>
      <ApprovalQueueTable
        rows={filteredRows}
        totalPendingFiltered={totalPendingFiltered}
        workDate={workDate}
        siteId={siteId}
        q={undefined}
      />
    </div>
  );
}

"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { TableVirtuoso } from "react-virtuoso";

import { ApprovalFilterStats } from "@/components/approval/approval-filter-stats";
import { CorrectionRequestDialog } from "@/components/attendance/correction-request-dialog";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Props = {
  initialRows: AttendanceCheckRow[];
  stats: { pending: number; confirmed: number; total: number };
  canRequestCorrection: boolean;
};

export function ApprovalHistoryShell({ initialRows, stats, canRequestCorrection }: Props) {
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const filtered = useMemo(() => {
    const s = deferredSearch.trim().toLowerCase();
    if (!s) return initialRows;
    return initialRows.filter((row) => {
      const name = row.workers?.name?.toLowerCase() ?? "";
      const idn = row.workers?.id_number?.toLowerCase() ?? "";
      return name.includes(s) || idn.includes(s);
    });
  }, [initialRows, deferredSearch]);

  return (
    <div className="space-y-3">
      <ApprovalFilterStats pending={stats.pending} confirmed={stats.confirmed} total={stats.total} />

      <div className="rounded border border-slate-200 bg-white p-3">
        <label className="block text-xs font-bold text-slate-700">بحث فوري</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="اسم أو هوية…"
          className="mt-1 w-full max-w-md border border-slate-300 px-2 py-1.5 text-sm"
          autoComplete="off"
        />
        <p className="mt-1 text-xs text-slate-500">
          {filtered.length} من {initialRows.length}
        </p>
        {canRequestCorrection ? (
          <p className="mt-2 text-xs font-bold text-amber-900">
            للسجلات المعتمدة: زر «طلب تعديل» يفتح السبب والحالة المطلوبة (حاضر / غائب / نصف يوم) ويُرسل للإدارة.
          </p>
        ) : null}
      </div>

      <div className="h-[min(70vh,900px)] overflow-hidden rounded border border-slate-300 bg-white">
        <TableVirtuoso
          data={filtered}
          fixedItemHeight={48}
          style={{ height: "100%" }}
          components={{
            Table: ({ style, ...props }) => (
              <table
                {...props}
                style={{ ...style, width: "100%", borderCollapse: "collapse" }}
                className="text-sm"
              />
            ),
          }}
          fixedHeaderContent={() => (
            <tr className="bg-slate-100 text-slate-800">
              <th className="border border-slate-300 px-3 py-2 text-right">العامل</th>
              <th className="border border-slate-300 px-3 py-2 text-right">الموقع</th>
              <th className="border border-slate-300 px-3 py-2 text-right">الجولة</th>
              <th className="border border-slate-300 px-3 py-2 text-right">الحالة</th>
              <th className="border border-slate-300 px-3 py-2 text-right">إجراء</th>
            </tr>
          )}
          itemContent={(_index, row) => (
            <>
              <td className="border border-slate-300 px-3 py-2 align-top">
                <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
              </td>
              <td className="border border-slate-300 px-3 py-2">{row.sites?.name ?? "-"}</td>
              <td className="border border-slate-300 px-3 py-2 text-xs">
                {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
              </td>
              <td className="border border-slate-300 px-3 py-2">
                {row.status === "present" ? "حاضر" : row.status === "absent" ? "غائب" : "نصف يوم"}
              </td>
              <td className="border border-slate-300 px-3 py-2">
                {canRequestCorrection ? <CorrectionRequestDialog checkId={row.id} /> : <span className="text-xs text-slate-400">—</span>}
              </td>
            </>
          )}
        />
      </div>

      {filtered.length === 0 && (
        <p className="p-4 text-center text-sm text-slate-500">لا توجد بيانات.</p>
      )}
    </div>
  );
}

"use client";

import { TableVirtuoso } from "react-virtuoso";

const LIST_H = "min(75vh, 900px)";

type Row = {
  workerId: number;
  worker_name: string;
  id_number: string;
  byDay: Record<string, string>;
  totalEquivalent: string;
};

type Props = {
  dayLabels: string[];
  tableRows: Row[];
};

export function MonthlyMatrixVirtuoso({ dayLabels, tableRows }: Props) {
  if (tableRows.length === 0) {
    return null;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ height: LIST_H }}>
      <TableVirtuoso
        data={tableRows}
        style={{ height: "100%" }}
        components={{
          Table: (props) => <table {...props} className="min-w-full border-collapse text-xs" dir="rtl" />,
        }}
        fixedHeaderContent={() => (
          <tr className="bg-slate-100 shadow-sm">
            <th className="sticky right-0 z-20 min-w-[140px] border-b border-slate-200 bg-slate-100 px-2 py-2 text-right">
              العامل
            </th>
            {dayLabels.map((day) => (
              <th
                key={day}
                className="min-w-[28px] border-b border-slate-200 px-1 py-2 text-center font-bold text-slate-700"
              >
                {day}
              </th>
            ))}
            <th className="sticky left-0 z-20 min-w-[88px] border-b border-r border-slate-200 bg-slate-100 px-2 py-2 text-center font-bold text-emerald-900">
              الإجمالي
            </th>
          </tr>
        )}
        itemContent={(_i, row) => (
          <tr className="border-b border-slate-200 hover:bg-slate-50/80">
            <td className="sticky right-0 z-10 bg-white px-2 py-2 text-right shadow-[2px_0_4px_-2px_rgba(0,0,0,0.08)]">
              <p className="font-bold text-slate-800">{row.worker_name}</p>
              <p className="text-[10px] text-slate-500">{row.id_number}</p>
            </td>
            {dayLabels.map((day) => (
              <td key={day} className="px-1 py-2 text-center tabular-nums text-slate-700">
                {row.byDay[day] ?? "-"}
              </td>
            ))}
            <td className="sticky left-0 z-10 border-r border-slate-200 bg-white px-2 py-2 text-center font-bold tabular-nums text-emerald-900 shadow-[-2px_0_4px_-2px_rgba(0,0,0,0.08)]">
              {row.totalEquivalent}
            </td>
          </tr>
        )}
      />
    </div>
  );
}

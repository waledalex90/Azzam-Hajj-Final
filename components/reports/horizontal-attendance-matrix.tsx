"use client";

import { memo, useMemo } from "react";
import { TableVirtuoso } from "react-virtuoso";

function daysInMonth(y: number, m: number) {
  return new Date(y, m, 0).getDate();
}

const TABLE_H = "min(72vh,900px)";

function cellMark(raw: unknown) {
  const s = raw === null || raw === undefined ? "" : String(raw).trim();
  if (!s) return "—";
  return s;
}

function HorizontalAttendanceMatrixTableInner({
  rows,
  year,
  month,
}: {
  rows: Record<string, unknown>[];
  year: number;
  month: number;
}) {
  const dim = useMemo(() => daysInMonth(year, month), [year, month]);
  const dayKeys = useMemo(
    () => Array.from({ length: dim }, (_, i) => `d${String(i + 1).padStart(2, "0")}`),
    [dim],
  );

  return (
    <div className="space-y-2" dir="rtl">
      <p className="text-[11px] text-slate-600">
        وسوم الخلايا: <span className="font-bold text-emerald-800">P</span> حضور،{" "}
        <span className="font-bold text-rose-800">A</span> غياب
      </p>
      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <div style={{ height: TABLE_H }}>
          <TableVirtuoso
            data={rows}
            style={{ height: "100%" }}
            fixedItemHeight={42}
            components={{
              Table: ({ style, ...props }) => (
                <table
                  {...props}
                  style={{ ...style, borderCollapse: "collapse", minWidth: Math.max(1020, 80 + dim * 34) }}
                  className="text-[11px]"
                />
              ),
            }}
            fixedHeaderContent={() => (
              <tr className="bg-slate-100">
                <th className="whitespace-nowrap border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-900">
                  رقم الموظف
                </th>
                <th className="whitespace-nowrap border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-900">
                  رقم الإقامة
                </th>
                <th className="whitespace-nowrap border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-900">
                  كود الموظف
                </th>
                <th className="min-w-[8rem] border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-900">
                  الاسم
                </th>
                <th className="min-w-[7rem] border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-900">
                  المقاول
                </th>
                <th className="min-w-[7rem] border border-slate-200 px-2 py-2 text-right font-extrabold text-slate-900">
                  الموقع
                </th>
                {dayKeys.map((k, i) => (
                  <th
                    key={k}
                    className="border border-slate-200 px-1 py-2 text-center font-bold text-slate-800"
                  >
                    {i + 1}
                  </th>
                ))}
                <th className="border border-slate-200 px-1 py-2 text-center font-bold">حضور</th>
                <th className="border border-slate-200 px-1 py-2 text-center font-bold">غياب</th>
                <th className="border border-slate-200 px-1 py-2 text-center font-bold">إجمالي أيام العمل</th>
              </tr>
            )}
            itemContent={(_index, row) => (
              <>
                <td className="border border-slate-200 px-2 py-1.5 font-mono text-slate-900">
                  {String(row.worker_id ?? "")}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 font-mono text-slate-800">
                  {String(row.id_number ?? "")}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 font-mono text-slate-800">
                  {String(row.employee_code ?? "")}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 font-bold text-slate-900">
                  {String(row.worker_name ?? "")}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 text-slate-700">
                  {String(row.contractor_name ?? "")}
                </td>
                <td className="border border-slate-200 px-2 py-1.5 text-slate-700">
                  {String(row.site_name ?? "")}
                </td>
                {dayKeys.map((k) => (
                  <td key={k} className="border border-slate-200 px-0.5 py-1.5 text-center font-bold text-slate-900">
                    {cellMark(row[k])}
                  </td>
                ))}
                <td className="border border-slate-200 px-1 py-1.5 text-center">
                  {String(row.present_days ?? "")}
                </td>
                <td className="border border-slate-200 px-1 py-1.5 text-center">
                  {String(row.absent_days ?? "")}
                </td>
                <td className="border border-slate-200 px-1 py-1.5 text-center font-bold text-emerald-900">
                  {String(row.attendance_day_equivalent ?? "")}
                </td>
              </>
            )}
          />
        </div>
      </div>
    </div>
  );
}

export const HorizontalAttendanceMatrixTable = memo(HorizontalAttendanceMatrixTableInner);

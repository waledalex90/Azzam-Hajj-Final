"use client";

import { TableVirtuoso } from "react-virtuoso";

import type { ContractorStatementRow } from "@/lib/data/reports";

const LIST_H = "min(56vh, 640px)";

type Props = {
  rows: ContractorStatementRow[];
};

function fmt(n: number) {
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}

export function ContractorsReportTable({ rows }: Props) {
  if (rows.length === 0) {
    return <p className="p-4 text-center text-sm text-slate-500">لا توجد بيانات للفترة المحددة.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ height: LIST_H }}>
      <TableVirtuoso
        data={rows}
        style={{ height: "100%" }}
        components={{
          Table: (props) => <table {...props} className="min-w-full border-collapse text-xs" dir="rtl" />,
        }}
        fixedHeaderContent={() => (
          <tr className="bg-slate-100 text-slate-900">
            <th className="sticky right-0 z-10 min-w-[160px] border-b border-slate-200 px-2 py-2 text-right font-bold">
              اسم المقاولة
            </th>
            <th className="min-w-[72px] border-b border-slate-200 px-2 py-2 text-center">عدد العمال</th>
            <th className="min-w-[88px] border-b border-slate-200 px-2 py-2 text-center">إجمالي المستحق</th>
            <th className="min-w-[88px] border-b border-slate-200 px-2 py-2 text-center">إجمالي الخصومات</th>
            <th className="min-w-[88px] border-b border-slate-200 px-2 py-2 text-center">الصافي</th>
          </tr>
        )}
        itemContent={(_i, r) => (
          <tr className="border-b border-slate-100 hover:bg-slate-50/80">
            <td className="sticky right-0 bg-white px-2 py-2 text-right font-bold text-slate-800">{r.contractor_name}</td>
            <td className="px-2 py-2 text-center tabular-nums">{r.worker_count}</td>
            <td className="px-2 py-2 text-center tabular-nums text-emerald-900">{fmt(r.total_due)}</td>
            <td className="px-2 py-2 text-center tabular-nums text-amber-900">{fmt(r.total_deductions)}</td>
            <td className="px-2 py-2 text-center font-bold tabular-nums text-slate-900">{fmt(r.net_total)}</td>
          </tr>
        )}
      />
    </div>
  );
}

"use client";

import { TableVirtuoso } from "react-virtuoso";

import type { WorkerFinancialReportRow } from "@/lib/data/reports";

const LIST_H = "min(72vh, 920px)";

type Props = {
  rows: WorkerFinancialReportRow[];
  variant: "attendance" | "payroll";
};

function fmt(n: number) {
  if (Number.isInteger(n)) return String(n);
  return n.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
}

export function FinancialReportTable({ rows, variant }: Props) {
  if (rows.length === 0) {
    return <p className="p-4 text-center text-sm text-slate-500">لا توجد صفوف مطابقة.</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white" style={{ height: LIST_H }}>
      <TableVirtuoso
        data={rows}
        style={{ height: "100%" }}
        components={{
          Table: (props) => <table {...props} className="min-w-full border-collapse text-xs" dir="rtl" />,
        }}
        fixedHeaderContent={() =>
          variant === "attendance" ? (
            <tr className="bg-slate-100 text-slate-900">
              <th className="sticky right-0 z-10 min-w-[120px] border-b border-slate-200 px-2 py-2 text-right font-bold">
                العامل
              </th>
              <th className="min-w-[100px] border-b border-slate-200 px-2 py-2">الهوية / الجواز</th>
              <th className="min-w-[100px] border-b border-slate-200 px-2 py-2">المقاول</th>
              <th className="min-w-[100px] border-b border-slate-200 px-2 py-2">الموقع</th>
              <th className="min-w-[72px] border-b border-slate-200 px-1 py-2 text-center">أيام معادلة</th>
              <th className="min-w-[48px] border-b border-slate-200 px-1 py-2 text-center">ح</th>
              <th className="min-w-[48px] border-b border-slate-200 px-1 py-2 text-center">ن</th>
              <th className="min-w-[48px] border-b border-slate-200 px-1 py-2 text-center">غ</th>
              <th className="min-w-[64px] border-b border-slate-200 px-1 py-2 text-center">وردية</th>
            </tr>
          ) : (
            <tr className="bg-slate-100 text-slate-900">
              <th className="sticky right-0 z-10 min-w-[120px] border-b border-slate-200 px-2 py-2 text-right font-bold">
                العامل
              </th>
              <th className="min-w-[100px] border-b border-slate-200 px-2 py-2">الهوية / الجواز</th>
              <th className="min-w-[100px] border-b border-slate-200 px-2 py-2">المقاول</th>
              <th className="min-w-[88px] border-b border-slate-200 px-2 py-2">التعاقد</th>
              <th className="min-w-[72px] border-b border-slate-200 px-1 py-2 text-center">يومية</th>
              <th className="min-w-[72px] border-b border-slate-200 px-1 py-2 text-center">أيام معادلة</th>
              <th className="min-w-[80px] border-b border-slate-200 px-1 py-2 text-center">المستحق</th>
              <th className="min-w-[72px] border-b border-slate-200 px-1 py-2 text-center">خصومات</th>
              <th className="min-w-[72px] border-b border-slate-200 px-1 py-2 text-center">الصافي</th>
            </tr>
          )
        }
        itemContent={(_i, r) =>
          variant === "attendance" ? (
            <tr className="border-b border-slate-100 hover:bg-slate-50/80">
              <td className="sticky right-0 bg-white px-2 py-2 text-right font-bold text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                {r.worker_name}
              </td>
              <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{r.id_number}</td>
              <td className="px-2 py-2 text-slate-700">{r.contractor_name || "—"}</td>
              <td className="px-2 py-2 text-slate-700">{r.site_name || "—"}</td>
              <td className="px-1 py-2 text-center tabular-nums text-emerald-900">{fmt(r.equivalent_days)}</td>
              <td className="px-1 py-2 text-center tabular-nums">{r.present_days}</td>
              <td className="px-1 py-2 text-center tabular-nums">{r.half_days}</td>
              <td className="px-1 py-2 text-center tabular-nums">{r.absent_days}</td>
              <td className="px-1 py-2 text-center text-[11px]">
                {r.shift_round === 1 ? "صباحي" : r.shift_round === 2 ? "مسائي" : "—"}
              </td>
            </tr>
          ) : (
            <tr className="border-b border-slate-100 hover:bg-slate-50/80">
              <td className="sticky right-0 bg-white px-2 py-2 text-right font-bold text-slate-800 shadow-[2px_0_4px_-2px_rgba(0,0,0,0.06)]">
                {r.worker_name}
              </td>
              <td className="px-2 py-2 font-mono text-[11px] text-slate-600">{r.id_number}</td>
              <td className="px-2 py-2 text-[11px] text-slate-700">{r.contractor_name || "—"}</td>
              <td className="px-2 py-2 text-[11px] text-slate-700">
                {r.payment_type === "daily" ? "يومي" : "شهري"}
              </td>
              <td className="px-1 py-2 text-center tabular-nums">{r.basic_salary != null ? fmt(r.basic_salary) : "—"}</td>
              <td className="px-1 py-2 text-center tabular-nums text-emerald-900">{fmt(r.equivalent_days)}</td>
              <td className="px-1 py-2 text-center tabular-nums">{fmt(r.gross_due)}</td>
              <td className="px-1 py-2 text-center tabular-nums text-amber-900">{fmt(r.violation_deductions)}</td>
              <td className="px-1 py-2 text-center font-bold tabular-nums text-slate-900">{fmt(r.net_due)}</td>
            </tr>
          )
        }
      />
    </div>
  );
}

"use client";

type Props = {
  pending: number;
  confirmed: number;
  total: number;
};

export function ApprovalFilterStats({ pending, confirmed, total }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-center shadow-sm">
        <p className="text-xs font-bold text-amber-900">بانتظار الاعتماد</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-950">{pending}</p>
      </div>
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center shadow-sm">
        <p className="text-xs font-bold text-emerald-900">تم الاعتماد</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-emerald-950">{confirmed}</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center shadow-sm">
        <p className="text-xs font-bold text-slate-700">إجمالي السجلات</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums text-slate-900">{total}</p>
      </div>
    </div>
  );
}

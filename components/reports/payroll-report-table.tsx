"use client";

import { useCallback, useEffect, useState } from "react";

import { savePayrollManualDeductionAction } from "@/app/(dashboard)/reports/payroll-actions";
import type { ReportFilters } from "@/lib/reports/queries";

function num(v: unknown): number {
  if (v === null || v === undefined || v === "") return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function PayrollReportTable({
  rows,
  periodStart,
  periodEnd,
  filter,
  locked,
  onSaved,
}: {
  rows: Record<string, unknown>[];
  periodStart: string;
  periodEnd: string;
  filter: Pick<ReportFilters, "siteIds" | "contractorIds" | "supervisorIds">;
  locked: boolean;
  onSaved: () => void;
}) {
  const [manual, setManual] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** تمييز الصافي مباشرة بعد الضغط على حفظ (قبل انتهاء الطلب). */
  const [flashNetId, setFlashNetId] = useState<number | null>(null);

  useEffect(() => {
    setManual((prev) => {
      const next = { ...prev };
      for (const r of rows) {
        const id = Number(r.worker_id);
        if (!Number.isFinite(id)) continue;
        if (next[id] !== undefined) continue;
        const m = r.manual_deductions_sar;
        next[id] = m === null || m === undefined ? "" : String(m);
      }
      return next;
    });
  }, [rows]);

  const saveOne = useCallback(
    async (workerId: number) => {
      if (locked) return;
      setError(null);
      const raw = manual[workerId]?.trim() ?? "";
      const amount = raw === "" ? 0 : Number(raw);
      if (raw !== "" && !Number.isFinite(amount)) {
        setError("أدخل مبلغاً رقماً صالحاً للخصم اليدوي");
        return;
      }
      setFlashNetId(workerId);
      window.setTimeout(() => setFlashNetId(null), 600);

      setSaving(workerId);
      try {
        await savePayrollManualDeductionAction({
          workerId,
          periodStart,
          periodEnd,
          amountSar: amount,
          filter,
        });
        onSaved();
      } catch (e) {
        setError(e instanceof Error ? e.message : "فشل الحفظ");
      } finally {
        setSaving(null);
      }
    },
    [filter, locked, manual, onSaved, periodEnd, periodStart],
  );

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-800">
          {error}
        </p>
      )}
      <p className="text-[11px] text-slate-600">
        اليومية المعروضة هي المستخدمة في الحساب (يومي = الراتب الأساسي، شهري = الأساس ÷ 30). الصافي يُحدَّث فور
        تغيير الخصم أو عند الحفظ. عند اعتماد المسير يُقفل التعديل.
      </p>
      <div>
        <table className="min-w-full text-xs">
          <thead className="sticky top-0 bg-slate-100">
            <tr>
              <th className="px-2 py-2 text-right">الاسم</th>
              <th className="px-2 py-2 text-right">رقم الإقامة</th>
              <th className="px-2 py-2 text-right">المقاول</th>
              <th className="px-2 py-2 text-right">الموقع</th>
              <th className="px-2 py-2 text-center">يومية العمل</th>
              <th className="px-2 py-2 text-center">إجمالي أيام الحضور</th>
              <th className="px-2 py-2 text-center">إجمالي الاستحقاق</th>
              <th className="px-2 py-2 text-center">خصومات المخالفات</th>
              <th className="px-2 py-2 text-center">خصومات يدوية</th>
              <th className="px-2 py-2 text-center">الصافي</th>
              <th className="px-2 py-2 text-center">حفظ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const workerId = Number(r.worker_id);
              const gross = num(r.gross_sar);
              const viol = num(r.violation_deductions_sar);
              const manualStr = manual[workerId] ?? "";
              const manualAmt = manualStr.trim() === "" ? 0 : Number(manualStr);
              const manualOk = manualStr.trim() === "" || Number.isFinite(manualAmt);
              const net = gross - viol - (manualOk ? manualAmt : 0);
              const flash = flashNetId === workerId;
              return (
                <tr key={workerId || idx} className="border-t border-slate-200">
                  <td className="max-w-[10rem] px-2 py-1.5 font-bold text-slate-900">
                    {String(r.worker_name ?? "")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 font-mono text-slate-800">
                    {String(r.id_number ?? "")}
                  </td>
                  <td className="max-w-[8rem] px-2 py-1.5 text-slate-700">{String(r.contractor_name ?? "")}</td>
                  <td className="max-w-[8rem] px-2 py-1.5 text-slate-700">{String(r.site_name ?? "")}</td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-mono">
                    {String(r.work_daily_rate_sar ?? "")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-mono">
                    {String(r.paid_day_equivalent ?? "")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-mono">
                    {String(r.gross_sar ?? "")}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-center font-mono text-rose-800">
                    {String(r.violation_deductions_sar ?? "")}
                  </td>
                  <td className="px-1 py-1">
                    <input
                      type="text"
                      inputMode="decimal"
                      disabled={locked}
                      className="w-full min-w-[4.5rem] rounded border border-slate-200 px-1 py-1 text-center font-mono disabled:bg-slate-100"
                      value={manual[workerId] ?? ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        setManual((prev) => ({ ...prev, [workerId]: v }));
                      }}
                      placeholder="0"
                    />
                  </td>
                  <td
                    className={`whitespace-nowrap px-2 py-1.5 text-center font-bold text-emerald-900 transition-shadow ${
                      flash ? "rounded bg-emerald-100 ring-2 ring-emerald-500" : ""
                    }`}
                  >
                    {manualOk ? net.toFixed(2) : "—"}
                  </td>
                  <td className="px-1 py-1 text-center">
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px] font-bold text-slate-800 disabled:opacity-40"
                      disabled={!Number.isFinite(workerId) || saving === workerId || locked}
                      onClick={() => void saveOne(workerId)}
                    >
                      {saving === workerId ? "…" : "حفظ"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

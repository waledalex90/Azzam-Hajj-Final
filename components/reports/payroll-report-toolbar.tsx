"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

import {
  approvePayrollPeriodAction,
  importPayrollDeductionsAction,
  unlockPayrollPeriodAction,
} from "@/app/(dashboard)/reports/payroll-actions";
import type { ReportFilters } from "@/lib/reports/queries";

function monthDateBounds(year: number, month: number) {
  const d1 = new Date(year, month - 1, 1);
  const d2 = new Date(year, month, 0);
  return { dateFrom: d1.toISOString().slice(0, 10), dateTo: d2.toISOString().slice(0, 10) };
}

function parseImportRows(raw: Record<string, unknown>[]): Array<{ workerId: number; amountSar: number }> {
  const out: Array<{ workerId: number; amountSar: number }> = [];
  for (const row of raw) {
    const wid = Number(
      row.worker_id ?? row.workerId ?? row["معرف الموظف"] ?? row["Worker ID"],
    );
    const amt = Number(
      row.manual_deductions_sar ??
        row.manual_deduction ??
        row.amount_sar ??
        row.amount ??
        row["خصم يدوي"] ??
        row["Manual"],
    );
    if (!Number.isFinite(wid) || wid <= 0) continue;
    out.push({ workerId: wid, amountSar: Number.isFinite(amt) ? amt : 0 });
  }
  return out;
}

export function PayrollReportToolbar({
  filters,
  year,
  month,
  locked,
  onAfterMutation,
}: {
  filters: ReportFilters;
  year: number;
  month: number;
  locked: boolean;
  onAfterMutation: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  /** إدراج مساحة التوقيع في ملفات Excel / PDF عند التصدير */
  const [includeExportSignature, setIncludeExportSignature] = useState(false);
  const { dateFrom, dateTo } = monthDateBounds(year, month);
  const filterPick = {
    siteIds: filters.siteIds,
    contractorIds: filters.contractorIds,
    supervisorIds: filters.supervisorIds,
  };

  const exportQuery = () => {
    const p = new URLSearchParams();
    p.set("dateFrom", dateFrom);
    p.set("dateTo", dateTo);
    p.set("year", String(year));
    p.set("month", String(month));
    if (filters.siteIds?.length) p.set("sites", filters.siteIds.join(","));
    if (filters.contractorIds?.length) p.set("contractors", filters.contractorIds.join(","));
    if (filters.supervisorIds?.length) p.set("supervisors", filters.supervisorIds.join(","));
    if (filters.shiftRound) p.set("shiftRound", String(filters.shiftRound));
    if (includeExportSignature) p.set("sign", "1");
    return p.toString();
  };

  async function run(label: string, fn: () => Promise<void>) {
    setMsg(null);
    setBusy(label);
    try {
      await fn();
      onAfterMutation();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "خطأ");
    } finally {
      setBusy(null);
    }
  }

  async function onFileChange(ev: React.ChangeEvent<HTMLInputElement>) {
    const f = ev.target.files?.[0];
    ev.target.value = "";
    if (!f) return;
    await run("import", async () => {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);
      const rows = parseImportRows(json);
      if (!rows.length) {
        throw new Error("لم يُعثر على صفوف صالحة (توقع أعمدة worker_id و manual_deductions_sar).");
      }
      const r = await importPayrollDeductionsAction({
        rows,
        periodStart: dateFrom,
        periodEnd: dateTo,
        filter: filterPick,
      });
      setMsg(`تم استيراد ${r.imported} سجلًا.`);
    });
  }

  return (
    <div className="mb-2 space-y-1.5">
      {msg && (
        <p className="rounded border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-bold text-amber-900">
          {msg}
        </p>
      )}
      {locked && (
        <p className="rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-900">
          مسير معتمد (مقفل) — تعديل الخصومات يتطلب إلغاء القفل (اعتماد/إدارة).
        </p>
      )}
      <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-slate-700">
        <input
          type="checkbox"
          checked={includeExportSignature}
          onChange={(e) => setIncludeExportSignature(e.target.checked)}
          className="h-3.5 w-3.5 rounded border-slate-400"
        />
        إدراج مساحة التوقيع في التصدير (Excel / PDF)
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.xlsx,.xls,text/csv"
          className="hidden"
          onChange={(e) => void onFileChange(e)}
        />
        <button
          type="button"
          disabled={!!busy || locked}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-800 disabled:opacity-40"
          onClick={() => fileRef.current?.click()}
        >
          {busy === "import" ? "…" : "استيراد"}
        </button>
        <button
          type="button"
          disabled={!!busy || locked}
          className="rounded-md bg-indigo-700 px-2 py-1.5 text-[11px] font-bold text-white disabled:opacity-40"
          onClick={() =>
            void run("approve", async () => {
              await approvePayrollPeriodAction(filters);
              setMsg("تم اعتماد المسير (قفل) لهذه الفترة والفلاتر.");
            })
          }
        >
          {busy === "approve" ? "…" : "اعتماد"}
        </button>
        <button
          type="button"
          disabled={!!busy || !locked}
          className="rounded-md border border-amber-600 bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-950 disabled:opacity-40"
          onClick={() =>
            void run("unlock", async () => {
              await unlockPayrollPeriodAction(filters);
              setMsg("تم إلغاء قفل المسير.");
            })
          }
        >
          {busy === "unlock" ? "…" : "إلغاء قفل"}
        </button>
        <a
          href={`/api/payroll/export?${exportQuery()}&format=xlsx`}
          className="rounded-md border border-emerald-700 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-900"
        >
          Excel
        </a>
        <a
          href={`/api/payroll/export?${exportQuery()}&format=pdf`}
          className="rounded-md border border-emerald-700 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-900"
        >
          PDF
        </a>
      </div>
    </div>
  );
}

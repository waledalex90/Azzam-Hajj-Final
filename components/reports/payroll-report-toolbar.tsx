"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";

import {
  approvePayrollPeriodAction,
  importPayrollDeductionsAction,
  unlockPayrollPeriodAction,
} from "@/app/(dashboard)/reports/payroll-actions";
import type { ReportFilters } from "@/lib/reports/queries";

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
  dateFrom,
  dateTo,
  year,
  month,
  locked,
  onAfterMutation,
}: {
  filters: ReportFilters;
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
  locked: boolean;
  onAfterMutation: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [includeRowSignature, setIncludeRowSignature] = useState(false);
  const [includeFooterSignature, setIncludeFooterSignature] = useState(false);
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
    if (includeRowSignature) p.set("rowSign", "1");
    if (includeFooterSignature) p.set("footerSign", "1");
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
      <div className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-700">
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeRowSignature}
            onChange={(e) => setIncludeRowSignature(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-400"
          />
          عمود توقيع بجانب اسم كل موظف (Excel / PDF)
        </label>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={includeFooterSignature}
            onChange={(e) => setIncludeFooterSignature(e.target.checked)}
            className="h-3.5 w-3.5 rounded border-slate-400"
          />
          توقيع إداري في نهاية الصفحة (Excel / PDF)
        </label>
      </div>
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

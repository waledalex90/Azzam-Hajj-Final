"use client";

import { useEffect, useMemo, useState } from "react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";

import { CorrectionRequestDialog } from "@/components/attendance/correction-request-dialog";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Props = {
  initialRows: AttendanceCheckRow[];
  canCorrection: boolean;
  shiftLabel?: string;
};

function reviewBadgeClass(status: "pending" | "confirmed" | "rejected") {
  if (status === "confirmed") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "rejected") return "bg-rose-50 text-rose-700 border-rose-200";
  return "bg-amber-50 text-amber-700 border-amber-200";
}

function reviewLabel(status: "pending" | "confirmed" | "rejected") {
  if (status === "confirmed") return "معتمد";
  if (status === "rejected") return "مرفوض";
  return "بانتظار الاعتماد";
}

const TABLE_H = "min(65vh,880px)";
const MOBILE_H = "min(50vh,520px)";

export function AttendanceReviewTab({ initialRows, canCorrection, shiftLabel }: Props) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter((row) => {
      const name = row.workers?.name?.toLowerCase() ?? "";
      const idn = row.workers?.id_number?.toLowerCase() ?? "";
      return name.includes(s) || idn.includes(s);
    });
  }, [rows, search]);

  return (
    <>
      <div className="rounded border border-slate-200 bg-white p-3">
        {shiftLabel ? (
          <p className="mb-2 text-xs font-bold text-emerald-800">
            الوردية المعروضة: <span className="text-slate-900">{shiftLabel}</span> — طلب التعديل يُرسل للإدارة مع السبب والحالة المطلوبة.
          </p>
        ) : null}
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
          {filtered.length} من {rows.length}
        </p>
      </div>

      <div className="overflow-hidden rounded border border-slate-300 bg-white">
        <div className="md:hidden" style={{ height: MOBILE_H }}>
          <Virtuoso
            data={filtered}
            style={{ height: "100%" }}
            fixedItemHeight={120}
            itemContent={(_index, row) => (
              <div className="border-b border-slate-200 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                  </div>
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${reviewBadgeClass(
                      row.confirmation_status,
                    )}`}
                  >
                    {reviewLabel(row.confirmation_status)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-600">الموقع: {row.sites?.name ?? "-"}</p>
                <div className="mt-2">
                  <CorrectionRequestDialog checkId={row.id} disabled={!canCorrection} />
                </div>
              </div>
            )}
          />
        </div>

        <div className="hidden md:block" style={{ height: TABLE_H }}>
          <TableVirtuoso
            data={filtered}
            fixedItemHeight={56}
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
              <tr className="bg-slate-100">
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">العامل</th>
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">الموقع</th>
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">الجولة</th>
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">الاعتماد</th>
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">إجراءات</th>
              </tr>
            )}
            itemContent={(_index, row) => (
              <>
                <td className="border border-slate-300 px-3 py-1 align-top">
                  <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                  <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                </td>
                <td className="border border-slate-300 px-3 py-1">{row.sites?.name ?? "-"}</td>
                <td className="border border-slate-300 px-3 py-1 text-xs">
                  {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                </td>
                <td className="border border-slate-300 px-3 py-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${reviewBadgeClass(
                      row.confirmation_status,
                    )}`}
                  >
                    {reviewLabel(row.confirmation_status)}
                  </span>
                </td>
                <td className="border border-slate-300 px-3 py-1 align-top">
                  <CorrectionRequestDialog checkId={row.id} disabled={!canCorrection} />
                </td>
              </>
            )}
          />
        </div>

        {filtered.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد سجلات ضمن البحث.</div>
        )}
      </div>
    </>
  );
}

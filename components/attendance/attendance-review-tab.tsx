"use client";

import { useEffect, useMemo, useState } from "react";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";

import { CancelHalfDayPrepButton } from "@/components/attendance/cancel-half-day-prep-button";
import { CorrectionRequestDialog } from "@/components/attendance/correction-request-dialog";
import type { AttendanceCheckRow } from "@/lib/types/db";
import { matchesClientSearch } from "@/lib/utils/client-search";

type Props = {
  initialRows: AttendanceCheckRow[];
  canCorrection: boolean;
  /** تعديل السجلات بعد التسجيل (إلغاء نصف يوم، إلخ.) — مفتاح edit_attendance */
  canEditAttendanceRecords?: boolean;
  /** مراقب ميداني: يرى من نُقِل للطابور للاطلاع فقط؛ الاعتماد لدى المراقب الفني */
  readOnlyReview?: boolean;
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

function prepStatusLabel(status: AttendanceCheckRow["status"]) {
  if (status === "present") return "حاضر";
  if (status === "absent") return "غائب";
  return "—";
}

const TABLE_H = "min(65vh,880px)";
const MOBILE_H = "min(50vh,520px)";

export function AttendanceReviewTab({
  initialRows,
  canCorrection,
  canEditAttendanceRecords = true,
  readOnlyReview = false,
  shiftLabel,
}: Props) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState(initialRows);

  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const filtered = useMemo(() => {
    const s = search.trim();
    if (!s) return rows;
    return rows.filter((row) =>
      matchesClientSearch(row.workers?.name, row.workers?.id_number, s, row.workers?.employee_code),
    );
  }, [rows, search]);

  return (
    <>
      <div className="rounded border border-slate-200 bg-white p-3">
        {readOnlyReview ? (
          <p className="mb-3 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-900">
            عرض فقط: هذه القائمة تُظهر من تم تحضيره وانتقل للطابور. تحضيرك الميداني مكتمل من جهتك؛ الاعتماد أو الرفض من
            المراقب الفني. يمكنك الرجوع إليها عند أي استفسار أو مشكلة.
          </p>
        ) : null}
        {shiftLabel ? (
          <p className="mb-2 text-xs font-bold text-emerald-800">
            الوردية المعروضة: <span className="text-slate-900">{shiftLabel}</span>
            {readOnlyReview
              ? " — نفس تاريخ التحضير والفلاتر."
              : canCorrection
                ? " — طلب التعديل (للمراقب الفني) يُرسل للإدارة مع السبب والحالة المطلوبة."
                : " — نفس تاريخ التحضير والفلاتر؛ الاعتماد وطلب التعديل من المراقب الفني."}
          </p>
        ) : null}
        <label className="block text-xs font-bold text-slate-700">بحث فوري</label>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="اسم أو هوية أو كود الموظف…"
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
                    {row.workers?.employee_code ? (
                      <p className="text-xs font-mono text-slate-600">{row.workers.employee_code}</p>
                    ) : null}
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
                <div className="mt-2 space-y-2">
                  <p className="text-[11px] font-bold text-slate-600">
                    التحضير: <span className="text-slate-900">{prepStatusLabel(row.status)}</span>
                  </p>
                  <CorrectionRequestDialog checkId={row.id} disabled={!canCorrection} />
                  {canEditAttendanceRecords &&
                  row.status === "half" &&
                  row.confirmation_status === "pending" ? (
                    <CancelHalfDayPrepButton checkId={row.id} />
                  ) : null}
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
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">التحضير</th>
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">الاعتماد</th>
                <th className="border border-slate-300 px-3 py-2 text-right font-bold">إجراءات</th>
              </tr>
            )}
            itemContent={(_index, row) => (
              <>
                <td className="border border-slate-300 px-3 py-1 align-top">
                  <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                  {row.workers?.employee_code ? (
                    <p className="text-xs font-mono text-slate-600">{row.workers.employee_code}</p>
                  ) : null}
                  <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                </td>
                <td className="border border-slate-300 px-3 py-1">{row.sites?.name ?? "-"}</td>
                <td className="border border-slate-300 px-3 py-1 text-xs">
                  {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                </td>
                <td className="border border-slate-300 px-3 py-1 text-xs font-bold">
                  {prepStatusLabel(row.status)}
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
                  <div className="flex flex-col gap-2">
                    <CorrectionRequestDialog checkId={row.id} disabled={!canCorrection} />
                    {canEditAttendanceRecords &&
                    row.status === "half" &&
                    row.confirmation_status === "pending" ? (
                      <CancelHalfDayPrepButton checkId={row.id} />
                    ) : null}
                  </div>
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

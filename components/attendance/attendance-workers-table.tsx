"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";

import { submitAttendancePrepBulk } from "@/app/(dashboard)/attendance/actions";
import type { WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

type Props = {
  rows: WorkerRow[];
  workDate: string;
  roundNo?: number;
  initialStatusMap?: Record<number, AttendanceStatus | undefined>;
  filteredWorkerIds?: number[];
  filteredTotalRows?: number;
  skipServerRefresh?: boolean;
  onAttendanceChunkSaved?: (workerIds: number[], status: AttendanceStatus) => void;
  onAttendanceSessionComplete?: () => void;
  /** بعد نجاح التحضير (صف أو دفعة): الانتقال لتبويب المراجعة */
  onPrepSuccessNavigate?: () => void;
  suppressEmptyMessage?: boolean;
};

function statusLabel(status?: AttendanceStatus) {
  if (status === "present") return "حاضر";
  if (status === "absent") return "غائب";
  if (status === "half") return "نصف يوم";
  return "غير محدد";
}

function statusBadgeClass(status?: AttendanceStatus) {
  if (status === "present") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (status === "absent") return "bg-rose-50 text-rose-700 border-rose-200";
  if (status === "half") return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-slate-50 text-slate-600 border-slate-200";
}

const TABLE_H = "min(70vh,900px)";
const MOBILE_H = "min(55vh,560px)";
/** يطابق الحد في `submitAttendancePrepBulk` — دفعات متتابعة مع شريط تقدّم */
const CLIENT_PREP_CHUNK = 500;

export function AttendanceWorkersTable({
  rows,
  workDate,
  roundNo = 1,
  initialStatusMap = {},
  filteredWorkerIds = [],
  filteredTotalRows = 0,
  skipServerRefresh = false,
  onAttendanceChunkSaved,
  onAttendanceSessionComplete,
  onPrepSuccessNavigate,
  suppressEmptyMessage = false,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkScope, setBulkScope] = useState<"page" | "all">("page");
  const statusMap = initialStatusMap;
  const [isSaving, setIsSaving] = useState(false);

  const visibleRows = rows;
  const allIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const pageAllSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const hasSelection = selected.length > 0;

  const allFilteredIds = useMemo(() => Array.from(new Set(filteredWorkerIds)), [filteredWorkerIds]);

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAllPage() {
    setSelected((prev) => {
      const pageSelected = allIds.every((id) => prev.includes(id));
      if (pageSelected) {
        return prev.filter((id) => !allIds.includes(id));
      }
      return Array.from(new Set([...prev, ...allIds]));
    });
  }

  async function runPrepBulk(status: AttendanceStatus) {
    if (!hasSelection || isSaving) return;
    const ids =
      bulkScope === "all"
        ? allFilteredIds
        : Array.from(new Set(selected.filter((id) => allIds.includes(id))));
    if (ids.length === 0) {
      toast.error("لا يوجد عامل ضمن النطاق.");
      return;
    }

    const chunks: number[][] = [];
    for (let i = 0; i < ids.length; i += CLIENT_PREP_CHUNK) {
      chunks.push(ids.slice(i, i + CLIENT_PREP_CHUNK));
    }

    setIsSaving(true);
    const progressId = chunks.length > 1 ? toast.loading(`جاري التحضير… 1/${chunks.length}`) : undefined;

    try {
      for (let i = 0; i < chunks.length; i += 1) {
        if (chunks.length > 1 && progressId !== undefined) {
          toast.loading(`جاري التحضير… ${i + 1}/${chunks.length}`, { id: progressId });
        }
        const res = await submitAttendancePrepBulk(workDate, status, chunks[i], roundNo, {
          /* منع revalidatePath أثناء التحضير المحلي — يتعارض مع تحديث الحالة ثم الانتقال (نفس السلوك لكل الأدوار) */
          revalidate: skipServerRefresh ? false : i === chunks.length - 1,
        });
        if (!res.ok) {
          toast.error(res.error, { id: progressId });
          if (skipServerRefresh) void router.refresh();
          return;
        }
        if (skipServerRefresh) {
          flushSync(() => {
            onAttendanceChunkSaved?.(chunks[i], status);
          });
        } else {
          onAttendanceChunkSaved?.(chunks[i], status);
        }
      }

      toast.success(
        chunks.length > 1 ? `تم التحضير — ${chunks.length} دفعة (${ids.length} عامل)` : "تم التحضير ✅",
        { id: progressId },
      );
      setSelected([]);
      if (!skipServerRefresh) {
        void router.refresh();
      }
      onAttendanceSessionComplete?.();
      onPrepSuccessNavigate?.();
    } finally {
      setIsSaving(false);
    }
  }

  function bulkButtons() {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void runPrepBulk("present")}
          className="rounded border border-emerald-800 bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={!hasSelection || isSaving}
        >
          تحضير المحدد كـ حاضر
        </button>
        <button
          type="button"
          onClick={() => void runPrepBulk("absent")}
          className="rounded border border-red-800 bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={!hasSelection || isSaving}
        >
          تحضير المحدد كـ غائب
        </button>
        <button
          type="button"
          onClick={() => void runPrepBulk("half")}
          className="rounded border border-amber-700 bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={!hasSelection || isSaving}
        >
          تحضير المحدد كنصف يوم
        </button>
      </div>
    );
  }

  const statusButtons = (workerId: number) => {
    async function onStatusClick(status: AttendanceStatus) {
      if (isSaving) return;
      setIsSaving(true);
      try {
        const res = await submitAttendancePrepBulk(
          workDate,
          status,
          [workerId],
          roundNo,
          skipServerRefresh ? { revalidate: false } : undefined,
        );
        if (!res.ok) {
          toast.error(res.error);
          if (skipServerRefresh) void router.refresh();
          return;
        }
        toast.success("تم التحضير ✅");
        if (skipServerRefresh) {
          flushSync(() => {
            onAttendanceChunkSaved?.([workerId], status);
          });
        } else {
          onAttendanceChunkSaved?.([workerId], status);
          void router.refresh();
        }
        onPrepSuccessNavigate?.();
      } finally {
        setIsSaving(false);
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => void onStatusClick("present")}
          className="rounded border border-emerald-800 bg-emerald-700 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
          disabled={isSaving}
        >
          حاضر
        </button>
        <button
          type="button"
          onClick={() => void onStatusClick("absent")}
          className="rounded border border-red-800 bg-red-700 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
          disabled={isSaving}
        >
          غائب
        </button>
        <button
          type="button"
          onClick={() => void onStatusClick("half")}
          className="rounded border border-amber-700 bg-amber-600 px-2 py-1 text-xs font-bold text-white disabled:opacity-40"
          disabled={isSaving}
        >
          نصف
        </button>
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(statusMap[workerId])}`}
        >
          {isSaving ? "…" : statusLabel(statusMap[workerId])}
        </span>
      </div>
    );
  };

  return (
    <div className="relative overflow-hidden rounded border border-slate-300 bg-white">
      {isSaving && !skipServerRefresh && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80">
          <div className="rounded border border-slate-300 bg-white px-4 py-3 text-center text-sm font-bold">
            جاري الحفظ…
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} disabled={isSaving} />
            تحديد المعروض ({allIds.length})
          </label>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            المحدد: {selected.length}
          </span>
          {isSaving && skipServerRefresh && <span className="text-xs font-bold text-amber-800">جاري الحفظ…</span>}
        </div>
        {bulkButtons()}
      </div>

      {hasSelection && (
        <div className="border-b border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
          <p className="mb-2 font-bold">نطاق التحضير</p>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="radio"
                name="prep-scope"
                checked={bulkScope === "page"}
                onChange={() => setBulkScope("page")}
                disabled={isSaving}
              />
              المعروض في الجدول فقط ({selected.length} محدد)
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="radio"
                name="prep-scope"
                checked={bulkScope === "all"}
                onChange={() => setBulkScope("all")}
                disabled={isSaving}
              />
              كل المعلّقين في الفلتر ({filteredTotalRows || allFilteredIds.length})
            </label>
          </div>
        </div>
      )}

      <div className={`md:hidden`} style={{ height: MOBILE_H }}>
        <Virtuoso
          data={visibleRows}
          style={{ height: "100%" }}
          fixedItemHeight={132}
          itemContent={(_index, worker) => (
            <div className="border-b border-slate-200 p-2">
              <label className="mb-1 inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                <input
                  type="checkbox"
                  checked={selected.includes(worker.id)}
                  onChange={() => toggle(worker.id)}
                  disabled={isSaving}
                />
                تحديد
              </label>
              <p className="font-bold text-slate-800">{worker.name}</p>
              <p className="text-xs text-slate-500">{worker.id_number}</p>
              <p className="mt-1 text-xs text-slate-500">{worker.sites?.name ?? "غير محدد"}</p>
              <div className="mt-2">{statusButtons(worker.id)}</div>
            </div>
          )}
        />
      </div>

      <div className="hidden md:block" style={{ height: TABLE_H }}>
        <TableVirtuoso
          data={visibleRows}
          fixedItemHeight={52}
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
              <th className="border border-slate-300 px-2 py-2 text-right font-bold">
                <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} disabled={isSaving} />
              </th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">#</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الاسم</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الهوية</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الموقع</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">إجراء</th>
            </tr>
          )}
          itemContent={(_index, worker) => (
            <>
              <td className="border border-slate-300 px-2 py-1">
                <input
                  type="checkbox"
                  checked={selected.includes(worker.id)}
                  onChange={() => toggle(worker.id)}
                  disabled={isSaving}
                />
              </td>
              <td className="border border-slate-300 px-3 py-1">{worker.id}</td>
              <td className="border border-slate-300 px-3 py-1 font-bold text-slate-800">{worker.name}</td>
              <td className="border border-slate-300 px-3 py-1">{worker.id_number}</td>
              <td className="border border-slate-300 px-3 py-1 text-slate-600">{worker.sites?.name ?? "—"}</td>
              <td className="border border-slate-300 px-3 py-1">{statusButtons(worker.id)}</td>
            </>
          )}
        />
      </div>

      {visibleRows.length === 0 && !suppressEmptyMessage && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات.</div>
      )}
    </div>
  );
}

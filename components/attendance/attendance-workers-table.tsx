"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TableVirtuoso, Virtuoso } from "react-virtuoso";

import { submitAttendancePrepBulk } from "@/app/(dashboard)/attendance/actions";
import { useAttendanceRscRefreshLock } from "@/components/attendance/attendance-rsc-refresh-lock";
import { useRunWithGlobalLock } from "@/components/providers/global-action-lock-context";
import type { WorkerRow } from "@/lib/types/db";
import { workerHasSiteForPrep } from "@/lib/utils/worker-prep-eligibility";

type AttendanceStatus = "present" | "absent" | "half";
type PrepSubmitStatus = "present" | "absent";

type Props = {
  rows: WorkerRow[];
  workDate: string;
  roundNo?: number;
  initialStatusMap?: Record<number, AttendanceStatus | undefined>;
  filteredWorkerIds?: number[];
  filteredTotalRows?: number;
  skipServerRefresh?: boolean;
  onAttendanceChunkSaved?: (workerIds: number[], status: PrepSubmitStatus) => void;
  onAttendanceSessionComplete?: () => void;
  /** بعد نجاح التحضير (صف أو دفعة): الانتقال لتبويب المراجعة */
  onPrepSuccessNavigate?: () => void;
  suppressEmptyMessage?: boolean;
  /** عرض القائمة دون أزرار التحضير (صلاحية view_attendance فقط) */
  readOnly?: boolean;
};

function statusLabel(status?: AttendanceStatus) {
  if (status === "present") return "حاضر";
  if (status === "absent") return "غائب";
  if (status === "half") return "—";
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
  readOnly = false,
}: Props) {
  const router = useRouter();
  const runLocked = useRunWithGlobalLock();
  const rscRefreshLock = useAttendanceRscRefreshLock();
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkScope, setBulkScope] = useState<"page" | "all">("page");
  const statusMap = initialStatusMap;
  const [isSaving, setIsSaving] = useState(false);

  const visibleRows = rows;
  const rowById = useMemo(() => new Map(visibleRows.map((r) => [r.id, r])), [visibleRows]);
  const allIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const eligibleOnPageIds = useMemo(
    () =>
      allIds.filter((id) => {
        const r = rowById.get(id);
        return r != null && workerHasSiteForPrep(r);
      }),
    [allIds, rowById],
  );
  const pageAllSelected =
    eligibleOnPageIds.length > 0 && eligibleOnPageIds.every((id) => selected.includes(id));
  const hasSelection = selected.length > 0;

  const allFilteredIds = useMemo(() => Array.from(new Set(filteredWorkerIds)), [filteredWorkerIds]);

  function toggle(id: number) {
    const row = rowById.get(id);
    if (row && !workerHasSiteForPrep(row)) {
      toast.error("هذا العامل بلا موقع معتمد في النظام. عيّن الموقع من شاشة «العمال» ثم أعد المحاولة.");
      return;
    }
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAllPage() {
    setSelected((prev) => {
      const eligibleOnPage = allIds.filter((id) => {
        const r = rowById.get(id);
        return r != null && workerHasSiteForPrep(r);
      });
      if (eligibleOnPage.length === 0) {
        toast.error("لا يوجد في الصفحة عمال لهم موقع معتمد — عيّن الموقع من «العمال».");
        return prev;
      }
      const pageSelected = eligibleOnPage.every((id) => prev.includes(id));
      if (pageSelected) {
        return prev.filter((id) => !eligibleOnPage.includes(id));
      }
      return Array.from(new Set([...prev, ...eligibleOnPage]));
    });
  }

  async function runPrepBulk(status: PrepSubmitStatus) {
    if (!hasSelection || isSaving) return;
    const ids =
      bulkScope === "all"
        ? allFilteredIds
        : Array.from(new Set(selected.filter((id) => allIds.includes(id))));
    if (ids.length === 0) {
      toast.error("لا يوجد عامل ضمن النطاق.");
      return;
    }

    const withSite = ids.filter((id) => {
      const r = rowById.get(id) ?? rows.find((x) => x.id === id);
      return r != null && workerHasSiteForPrep(r);
    });
    if (withSite.length === 0) {
      toast.error(
        "لا يوجد في التحديد أي عامل له موقع (الموقع الحالي). عيّن الموقع لكل عامل من شاشة «العمال» أو حدّث الاستيراد.",
      );
      return;
    }
    if (withSite.length < ids.length) {
      toast.warning(`تجاهل ${ids.length - withSite.length} عامل بلا موقع — يُحفظ ${withSite.length} فقط.`);
    }

    const chunks: number[][] = [];
    for (let i = 0; i < withSite.length; i += CLIENT_PREP_CHUNK) {
      chunks.push(withSite.slice(i, i + CLIENT_PREP_CHUNK));
    }

    await runLocked(async () => {
      setIsSaving(true);
      if (rscRefreshLock) rscRefreshLock.blockRscRefreshRef.current = true;
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
          chunks.length > 1 ? `تم التحضير — ${chunks.length} دفعة (${withSite.length} عامل)` : "تم التحضير ✅",
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
        if (rscRefreshLock) rscRefreshLock.blockRscRefreshRef.current = false;
      }
    });
  }

  function bulkButtons() {
    if (readOnly) {
      return (
        <p className="text-xs font-bold text-slate-600">وضع العرض فقط — لا تملك صلاحية تعديل الحضور.</p>
      );
    }
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
      </div>
    );
  }

  const statusButtons = (workerId: number) => {
    const worker = rowById.get(workerId);
    const prepEligible = worker != null && workerHasSiteForPrep(worker);

    async function onStatusClick(status: PrepSubmitStatus) {
      if (isSaving) return;
      if (!prepEligible) {
        toast.error("لا يمكن التحضير بدون موقع معتمد للعامل — حدّث الموقع من «العمال».");
        return;
      }
      await runLocked(async () => {
        setIsSaving(true);
        if (rscRefreshLock) rscRefreshLock.blockRscRefreshRef.current = true;
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
          if (rscRefreshLock) rscRefreshLock.blockRscRefreshRef.current = false;
        }
      });
    }

    if (!prepEligible) {
      return (
        <span
          className="inline-block max-w-[140px] text-[11px] font-bold leading-snug text-rose-700"
          title="التحضير في النظام يتطلب تعبئة «الموقع الحالي» للعامل من شاشة العمال."
        >
          بلا موقع — عيّن الموقع أولاً
        </span>
      );
    }

    if (readOnly) {
      return (
        <span
          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${statusBadgeClass(statusMap[workerId])}`}
        >
          {statusLabel(statusMap[workerId])}
        </span>
      );
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
          {!readOnly ? (
            <>
              <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
                <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} disabled={isSaving} />
                تحديد المعروض ({allIds.length})
              </label>
              <span className="rounded bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
                المحدد: {selected.length}
              </span>
            </>
          ) : (
            <span className="text-sm font-bold text-slate-700">المعلّقون ({allIds.length})</span>
          )}
          {isSaving && skipServerRefresh && <span className="text-xs font-bold text-amber-800">جاري الحفظ…</span>}
        </div>
        {bulkButtons()}
      </div>

      {!readOnly && hasSelection && (
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
              {!readOnly ? (
                <label className="mb-1 inline-flex items-center gap-2 text-xs font-bold text-slate-600">
                  <input
                    type="checkbox"
                    checked={selected.includes(worker.id)}
                    onChange={() => toggle(worker.id)}
                    disabled={isSaving || !workerHasSiteForPrep(worker)}
                  />
                  تحديد
                </label>
              ) : null}
              <p className="font-bold text-slate-800">{worker.name}</p>
              <p className="text-xs text-slate-500">{worker.id_number}</p>
              <p className="mt-1 text-xs text-slate-500">
                {workerHasSiteForPrep(worker) ? (worker.sites?.name ?? "—") : (
                  <span className="font-bold text-rose-600">بلا موقع — لن يُحفظ التحضير</span>
                )}
              </p>
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
              {!readOnly ? (
                <th className="border border-slate-300 px-2 py-2 text-right font-bold">
                  <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} disabled={isSaving} />
                </th>
              ) : null}
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">#</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الاسم</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الهوية</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الموقع</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">إجراء</th>
            </tr>
          )}
          itemContent={(_index, worker) => (
            <>
              {!readOnly ? (
                <td className="border border-slate-300 px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selected.includes(worker.id)}
                    onChange={() => toggle(worker.id)}
                    disabled={isSaving || !workerHasSiteForPrep(worker)}
                  />
                </td>
              ) : null}
              <td className="border border-slate-300 px-3 py-1">{worker.id}</td>
              <td className="border border-slate-300 px-3 py-1 font-bold text-slate-800">{worker.name}</td>
              <td className="border border-slate-300 px-3 py-1">{worker.id_number}</td>
              <td className="border border-slate-300 px-3 py-1 text-slate-600">
                {workerHasSiteForPrep(worker) ? (worker.sites?.name ?? "—") : (
                  <span className="font-bold text-rose-600">بلا موقع</span>
                )}
              </td>
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

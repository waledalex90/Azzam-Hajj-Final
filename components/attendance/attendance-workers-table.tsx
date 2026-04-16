"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

type Props = {
  rows: WorkerRow[];
  workDate: string;
  initialStatusMap?: Record<number, AttendanceStatus | undefined>;
  filteredWorkerIds?: number[];
  filteredTotalRows?: number;
  /** يُستدعى بعد كل طلب ناجح (بما فيه كل جزء من التحضير الجماعي) لتحديث العدادات وإخفاء الصف محلياً */
  onAttendanceChunkSaved?: (workerIds: number[], status: AttendanceStatus) => void;
  /** يُستدعى بعد اكتمال التحضير الجماعي فقط — للانتقال لتبويب المراجعة */
  onAttendanceSessionComplete?: () => void;
  /** إخفاء رسالة «لا توجد بيانات» عندما يعرض الأب رسالة بديلة (مثلاً بعد إخفاء الصف محلياً) */
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

const SAVE_ERROR_MESSAGE = "فشل الحفظ.. البيانات لم تصل للسيرفر";
const BULK_CHUNK_SIZE = 200;

type SyncProgress = {
  active: boolean;
  processed: number;
  total: number;
};

export function AttendanceWorkersTable({
  rows,
  workDate,
  initialStatusMap = {},
  filteredWorkerIds = [],
  filteredTotalRows = 0,
  onAttendanceChunkSaved,
  onAttendanceSessionComplete,
  suppressEmptyMessage = false,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const statusMap = initialStatusMap;
  const [isSaving, setIsSaving] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [isSyncError, setIsSyncError] = useState(false);
  const [syncProgress, setSyncProgress] = useState<SyncProgress>({
    active: false,
    processed: 0,
    total: 0,
  });

  const visibleRows = rows;
  const allIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const allFilteredIds = useMemo(() => {
    const source = filteredWorkerIds.length > 0 ? filteredWorkerIds : allIds;
    return Array.from(new Set(source));
  }, [filteredWorkerIds, allIds]);
  const pageAllSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const allFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.includes(id));
  const progressPercent = syncProgress.total
    ? Math.min(100, Math.round((syncProgress.processed / syncProgress.total) * 100))
    : 0;

  async function submitAttendance(status: AttendanceStatus, workerIds: number[]) {
    const response = await fetch("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "attendance_submit",
        workDate,
        status,
        workerIds,
      }),
    });

    if (response.status !== 200) {
      throw new Error(SAVE_ERROR_MESSAGE);
    }

    const payload = (await response.json().catch(() => ({}))) as { ok?: boolean };
    if (!payload.ok) {
      throw new Error(SAVE_ERROR_MESSAGE);
    }
  }

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

  function toggleAllFiltered() {
    setSelected((prev) => {
      const filteredSelected = allFilteredIds.every((id) => prev.includes(id));
      if (filteredSelected) {
        return prev.filter((id) => !allFilteredIds.includes(id));
      }
      return Array.from(new Set([...prev, ...allFilteredIds]));
    });
  }

  function bulkButtons() {
    async function handleAttendance(status: AttendanceStatus) {
      if (selected.length === 0 || isSaving) return;
      const selectedCount = selected.length;
      const selectedIdsSnapshot = [...selected];
      setIsSaving(true);
      setSyncMessage(null);
      setIsSyncError(false);
      setSyncProgress({ active: true, processed: 0, total: selectedCount });
      try {
        for (let i = 0; i < selectedIdsSnapshot.length; i += BULK_CHUNK_SIZE) {
          const chunk = selectedIdsSnapshot.slice(i, i + BULK_CHUNK_SIZE);
          await submitAttendance(status, chunk);
          onAttendanceChunkSaved?.(chunk, status);
          void router.refresh();
          setSelected((prev) => prev.filter((id) => !chunk.includes(id)));
          setSyncProgress({
            active: true,
            processed: Math.min(i + chunk.length, selectedCount),
            total: selectedCount,
          });
        }
        setSyncMessage(`تم التحضير بنجاح لعدد ${selectedCount} موظف.`);
        setSelected([]);
        onAttendanceSessionComplete?.();
      } catch (error) {
        const message = error instanceof Error ? error.message : SAVE_ERROR_MESSAGE;
        setSyncMessage(message || SAVE_ERROR_MESSAGE);
        setIsSyncError(true);
      } finally {
        setIsSaving(false);
        setSyncProgress((prev) => ({ ...prev, active: false }));
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => handleAttendance("present")}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0 || isSaving}
        >
          تحضير المحدد كـ حاضر
        </button>
        <button
          type="button"
          onClick={() => handleAttendance("absent")}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0 || isSaving}
        >
          تحضير المحدد كـ غائب
        </button>
        <button
          type="button"
          onClick={() => handleAttendance("half")}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0 || isSaving}
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
      setSyncMessage(null);
      setIsSyncError(false);
      setSyncProgress({ active: true, processed: 0, total: 1 });
      try {
        await submitAttendance(status, [workerId]);
        onAttendanceChunkSaved?.([workerId], status);
        void router.refresh();
        setSyncProgress({ active: true, processed: 1, total: 1 });
        setSyncMessage("تم تحضير الموظف بنجاح.");
      } catch (error) {
        const message = error instanceof Error ? error.message : SAVE_ERROR_MESSAGE;
        setSyncMessage(message || SAVE_ERROR_MESSAGE);
        setIsSyncError(true);
      } finally {
        setIsSaving(false);
        setSyncProgress((prev) => ({ ...prev, active: false }));
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onStatusClick("present")}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={isSaving}
        >
          حاضر
        </button>
        <button
          type="button"
          onClick={() => onStatusClick("absent")}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={isSaving}
        >
          غائب
        </button>
        <button
          type="button"
          onClick={() => onStatusClick("half")}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={isSaving}
        >
          نصف
        </button>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(statusMap[workerId])}`}
        >
          {isSaving ? "جارٍ الحفظ..." : statusLabel(statusMap[workerId])}
        </span>
      </div>
    );
  };

  return (
    <Card className="relative overflow-hidden p-0">
      {isSaving && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 backdrop-blur-sm">
          <div className="min-w-[280px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-center shadow-sm">
            <span className="mx-auto mb-2 inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-700 border-t-transparent" />
            <p className="text-sm font-bold text-slate-800">جاري الحفظ... برجاء الانتظار</p>
            {syncProgress.total > 0 && (
              <>
                <p className="mt-1 text-xs font-bold text-slate-600">
                  {syncProgress.processed} / {syncProgress.total}
                </p>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-slate-700 transition-all duration-200" style={{ width: `${progressPercent}%` }} />
                </div>
              </>
            )}
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} disabled={isSaving} />
            تحديد الصفحة ({allIds.length})
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} disabled={isSaving} />
            تحديد كل نتائج الفلترة ({filteredTotalRows || allFilteredIds.length})
          </label>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold text-slate-600">
            المحدد حاليًا: {selected.length}
          </span>
          {syncMessage && (
            <span
              className={`rounded-full border px-2 py-1 text-xs font-bold ${
                isSyncError
                  ? "border-red-200 bg-red-50 text-red-700"
                  : "border-emerald-200 bg-emerald-50 text-emerald-700"
              }`}
            >
              {syncMessage}
            </span>
          )}
        </div>
        {bulkButtons()}
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {visibleRows.map((worker) => (
          <div key={worker.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <label className="mb-2 inline-flex items-center gap-2 text-xs font-bold text-slate-600">
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
            <p className="mt-1 text-[11px] text-slate-500">
              الحالة الحالية: <span className="font-bold">{statusLabel(statusMap[worker.id])}</span>
            </p>
            <div className="mt-3">{statusButtons(worker.id)}</div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-right font-bold">
                <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} disabled={isSaving} />
              </th>
              <th className="px-3 py-2 text-right font-bold">#</th>
              <th className="px-3 py-2 text-right font-bold">الاسم</th>
              <th className="px-3 py-2 text-right font-bold">رقم الهوية</th>
              <th className="px-3 py-2 text-right font-bold">الموقع</th>
              <th className="px-3 py-2 text-right font-bold">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((worker) => (
              <tr key={worker.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(worker.id)}
                    onChange={() => toggle(worker.id)}
                    disabled={isSaving}
                  />
                </td>
                <td className="px-3 py-2">{worker.id}</td>
                <td className="px-3 py-2 font-bold text-slate-800">{worker.name}</td>
                <td className="px-3 py-2">{worker.id_number}</td>
                <td className="px-3 py-2 text-slate-600">{worker.sites?.name ?? "غير محدد"}</td>
                <td className="px-3 py-2">{statusButtons(worker.id)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {visibleRows.length === 0 && !suppressEmptyMessage && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات في الصفحة الحالية.</div>
      )}
    </Card>
  );
}

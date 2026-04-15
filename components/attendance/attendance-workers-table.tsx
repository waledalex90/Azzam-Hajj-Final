"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import type { WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

type Props = {
  rows: WorkerRow[];
  workDate: string;
  initialStatusMap?: Record<number, AttendanceStatus>;
  filteredWorkerIds?: number[];
  filteredTotalRows?: number;
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

type QueueOperation = {
  idempotencyKey: string;
  workDate: string;
  status: AttendanceStatus;
  workerIds: number[];
};

const SAVE_ERROR_MESSAGE = "فشل الحفظ.. البيانات لم تصل للسيرفر";

type SyncProgress = {
  active: boolean;
  processed: number;
  total: number;
};

function makeIdempotencyKey() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function AttendanceWorkersTable({
  rows,
  workDate,
  initialStatusMap = {},
  filteredWorkerIds = [],
  filteredTotalRows = 0,
}: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<number[]>([]);
  const statusMap = initialStatusMap;
  const [isSaving, setIsSaving] = useState(false);
  const [activeWorkerId, setActiveWorkerId] = useState<number | null>(null);
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

  const mutate = useCallback(() => {
    router.refresh();
  }, [router]);

  async function postSyncOperation(operation: QueueOperation) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      throw new Error(SAVE_ERROR_MESSAGE);
    }

    const response = await fetch("/api/attendance/bulk-sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "attendance_submit", ...operation }),
    });

    if (!response.ok) {
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
      setActiveWorkerId(null);
      setSyncMessage(null);
      setIsSyncError(false);
      setSyncProgress({ active: true, processed: 0, total: selectedCount });
      try {
        await postSyncOperation({
          idempotencyKey: makeIdempotencyKey(),
          workDate,
          status,
          workerIds: selectedIdsSnapshot,
        });
        setSyncProgress({ active: true, processed: selectedCount, total: selectedCount });
        setSyncMessage(`تم التحضير بنجاح لعدد ${selectedCount} موظف.`);
        setSelected([]);
        mutate();
      } catch (error) {
        const message = error instanceof Error ? error.message : SAVE_ERROR_MESSAGE;
        setSyncMessage(message || SAVE_ERROR_MESSAGE);
        setIsSyncError(true);
      } finally {
        setIsSaving(false);
        setSyncProgress((prev) => ({ active: false, processed: prev.processed, total: prev.total }));
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
    const pending = activeWorkerId === workerId && isSaving;

    async function onStatusClick(status: AttendanceStatus) {
      if (pending || isSaving) return;
      setIsSaving(true);
      setActiveWorkerId(workerId);
      setSyncMessage(null);
      setIsSyncError(false);
      setSyncProgress({ active: true, processed: 0, total: 1 });

      const operation: QueueOperation = {
        idempotencyKey: makeIdempotencyKey(),
        workDate,
        status,
        workerIds: [workerId],
      };
      try {
        await postSyncOperation(operation);
        setSyncProgress({ active: true, processed: 1, total: 1 });
        setSyncMessage("تم تحضير الموظف بنجاح.");
        mutate();
      } catch (error) {
        const message = error instanceof Error ? error.message : SAVE_ERROR_MESSAGE;
        setSyncMessage(message || SAVE_ERROR_MESSAGE);
        setIsSyncError(true);
      } finally {
        setIsSaving(false);
        setActiveWorkerId(null);
        setSyncProgress((prev) => ({ active: false, processed: prev.processed, total: prev.total }));
      }
    }

    return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onStatusClick("present")}
        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        disabled={pending || isSaving}
      >
          حاضر
      </button>
      <button
        type="button"
        onClick={() => onStatusClick("absent")}
        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        disabled={pending || isSaving}
      >
          غائب
      </button>
      <button
        type="button"
        onClick={() => onStatusClick("half")}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        disabled={pending || isSaving}
      >
          نصف
      </button>
      <span
        className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeClass(statusMap[workerId])}`}
      >
        {pending ? "جارٍ الحفظ..." : statusLabel(statusMap[workerId])}
      </span>
    </div>
    );
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 p-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
            <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} />
            تحديد الصفحة ({allIds.length})
          </label>
          <label className="inline-flex items-center gap-2 text-sm font-bold text-emerald-700">
            <input type="checkbox" checked={allFilteredSelected} onChange={toggleAllFiltered} />
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
          {syncProgress.active && syncProgress.total > 0 && (
            <div className="min-w-[260px] rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
              <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
                <span>
                  جاري الحفظ في قاعدة البيانات... ({syncProgress.processed} / {syncProgress.total})
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-emerald-100">
                <div className="h-full rounded-full bg-emerald-700 transition-all duration-300" style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
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
                <input type="checkbox" checked={pageAllSelected} onChange={toggleAllPage} />
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
      {visibleRows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات في الصفحة الحالية.</div>
      )}
    </Card>
  );
}

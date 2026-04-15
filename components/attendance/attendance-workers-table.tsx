"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  createdAt: string;
};

const QUEUE_STORAGE_KEY = "attendance-offline-queue-v1";

function readQueue(): QueueOperation[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as QueueOperation[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue: QueueOperation[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
}

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
  const [statusMap, setStatusMap] = useState<Record<number, AttendanceStatus>>(initialStatusMap);
  const [pendingWorkerIds, setPendingWorkerIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const isFlushingRef = useRef(false);

  const allIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allFilteredIds = useMemo(() => {
    const source = filteredWorkerIds.length > 0 ? filteredWorkerIds : allIds;
    return Array.from(new Set(source));
  }, [filteredWorkerIds, allIds]);
  const pageAllSelected = allIds.length > 0 && allIds.every((id) => selected.includes(id));
  const allFilteredSelected =
    allFilteredIds.length > 0 && allFilteredIds.every((id) => selected.includes(id));

  const flushQueue = useCallback(async () => {
    if (isFlushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    isFlushingRef.current = true;
    try {
      let queue = readQueue();
      let processedAny = false;
      while (queue.length > 0) {
        const next = queue[0];
        const response = await fetch("/api/attendance/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) break;

        queue = queue.slice(1);
        processedAny = true;
        writeQueue(queue);
        setPendingWorkerIds((prev) => prev.filter((id) => !next.workerIds.includes(id)));
      }
      if (processedAny) {
        router.refresh();
      }
    } finally {
      isFlushingRef.current = false;
    }
  }, [router]);

  function enqueueOperation(operation: QueueOperation) {
    const queue = readQueue();
    if (queue.some((item) => item.idempotencyKey === operation.idempotencyKey)) return;
    queue.push(operation);
    writeQueue(queue);
  }

  useEffect(() => {
    const queue = readQueue();
    if (queue.length > 0) {
      setPendingWorkerIds(Array.from(new Set(queue.flatMap((item) => item.workerIds))));
      setStatusMap((prev) => {
        const next = { ...prev };
        for (const op of queue) {
          op.workerIds.forEach((id) => {
            next[id] = op.status;
          });
        }
        return next;
      });
    }

    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener("online", onOnline);
    void flushQueue();
    return () => {
      window.removeEventListener("online", onOnline);
    };
  }, [flushQueue]);

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
    async function onBulk(status: AttendanceStatus) {
      if (selected.length === 0 || bulkPending) return;
      const selectedCount = selected.length;
      setBulkPending(true);
      setPendingWorkerIds((prev) => Array.from(new Set([...prev, ...selected])));
      setStatusMap((prev) => {
        const next = { ...prev };
        selected.forEach((id) => {
          next[id] = status;
        });
        return next;
      });

      const operation: QueueOperation = {
        idempotencyKey: makeIdempotencyKey(),
        workDate,
        status,
        workerIds: selected,
        createdAt: new Date().toISOString(),
      };
      enqueueOperation(operation);
      try {
        await flushQueue();
        setSyncMessage(`تم التحضير بنجاح لعدد ${selectedCount} موظف.`);
      } finally {
        const remainingQueue = readQueue();
        const queuedIds = new Set(remainingQueue.flatMap((item) => item.workerIds));
        setPendingWorkerIds((prev) => prev.filter((id) => queuedIds.has(id)));
        setSelected([]);
        setBulkPending(false);
      }
    }

    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onBulk("present")}
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0 || bulkPending}
        >
          تحضير المحدد كـ حاضر
        </button>
        <button
          type="button"
          onClick={() => onBulk("absent")}
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0 || bulkPending}
        >
          تحضير المحدد كـ غائب
        </button>
        <button
          type="button"
          onClick={() => onBulk("half")}
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0 || bulkPending}
        >
          تحضير المحدد كنصف يوم
        </button>
      </div>
    );
  }

  const statusButtons = (workerId: number) => {
    const pending = pendingWorkerIds.includes(workerId);

    async function onStatusClick(status: AttendanceStatus) {
      if (pending || bulkPending) return;
      setPendingWorkerIds((prev) => [...prev, workerId]);
      setStatusMap((prev) => ({ ...prev, [workerId]: status }));

      const operation: QueueOperation = {
        idempotencyKey: makeIdempotencyKey(),
        workDate,
        status,
        workerIds: [workerId],
        createdAt: new Date().toISOString(),
      };
      enqueueOperation(operation);
      try {
        await flushQueue();
        setSyncMessage("تم تحضير الموظف بنجاح.");
      } finally {
        const stillQueued = readQueue().some((op) => op.workerIds.includes(workerId));
        if (!stillQueued) {
          setPendingWorkerIds((prev) => prev.filter((id) => id !== workerId));
        }
      }
    }

    return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onStatusClick("present")}
        className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        disabled={pending || bulkPending}
      >
          حاضر
      </button>
      <button
        type="button"
        onClick={() => onStatusClick("absent")}
        className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        disabled={pending || bulkPending}
      >
          غائب
      </button>
      <button
        type="button"
        onClick={() => onStatusClick("half")}
        className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
        disabled={pending || bulkPending}
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
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">
              {syncMessage}
            </span>
          )}
        </div>
        {bulkButtons()}
      </div>

      <div className="space-y-3 p-3 md:hidden">
        {rows.map((worker) => (
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
            {rows.map((worker) => (
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
      {rows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات في الصفحة الحالية.</div>
      )}
    </Card>
  );
}

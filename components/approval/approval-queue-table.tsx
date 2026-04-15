"use client";

import { useEffect, useRef, useState } from "react";

import { Card } from "@/components/ui/card";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Decision = "confirm" | "reject";

type QueueOperation = {
  mode: "approval_decision";
  decision: Decision;
  checkIds: number[];
  idempotencyKey: string;
  createdAt: string;
};

type Props = {
  rows: AttendanceCheckRow[];
};

const QUEUE_STORAGE_KEY = "approval-offline-queue-v1";

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

export function ApprovalQueueTable({ rows }: Props) {
  const [optimisticRows, setOptimisticRows] = useState<AttendanceCheckRow[]>(rows);
  const [pendingCheckIds, setPendingCheckIds] = useState<number[]>([]);
  const isFlushingRef = useRef(false);

  const queuedCount = readQueue().length;

  useEffect(() => {
    const queuedIds = new Set(readQueue().flatMap((item) => item.checkIds));
    setOptimisticRows(rows.filter((row) => !queuedIds.has(row.id)));
  }, [rows]);

  async function flushQueue() {
    if (isFlushingRef.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    isFlushingRef.current = true;
    try {
      let queue = readQueue();
      while (queue.length > 0) {
        const next = queue[0];
        const response = await fetch("/api/attendance/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next),
        });
        if (!response.ok) break;
        queue = queue.slice(1);
        writeQueue(queue);
        setPendingCheckIds((prev) => prev.filter((id) => !next.checkIds.includes(id)));
      }
    } finally {
      isFlushingRef.current = false;
    }
  }

  function enqueueOperation(operation: QueueOperation) {
    const queue = readQueue();
    if (queue.some((item) => item.idempotencyKey === operation.idempotencyKey)) return;
    queue.push(operation);
    writeQueue(queue);
  }

  useEffect(() => {
    const queue = readQueue();
    if (queue.length > 0) {
      const queuedIds = queue.flatMap((item) => item.checkIds);
      setPendingCheckIds(Array.from(new Set(queuedIds)));
      setOptimisticRows((prev) => prev.filter((row) => !queuedIds.includes(row.id)));
    }

    const onOnline = () => {
      void flushQueue();
    };
    window.addEventListener("online", onOnline);
    void flushQueue();
    return () => window.removeEventListener("online", onOnline);
  }, []);

  async function onDecision(checkId: number, decision: Decision) {
    setPendingCheckIds((prev) => Array.from(new Set([...prev, checkId])));
    setOptimisticRows((prev) => prev.filter((row) => row.id !== checkId));

    const op: QueueOperation = {
      mode: "approval_decision",
      decision,
      checkIds: [checkId],
      idempotencyKey: makeIdempotencyKey(),
      createdAt: new Date().toISOString(),
    };
    enqueueOperation(op);
    await flushQueue();
  }

  return (
    <Card className="overflow-hidden p-0">
      {queuedCount > 0 && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
          يوجد {queuedCount} عملية اعتماد قيد المعالجة، وسيتم استكمالها تلقائيًا.
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-right">العامل</th>
              <th className="px-3 py-2 text-right">الموقع</th>
              <th className="px-3 py-2 text-right">الجولة</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              <th className="px-3 py-2 text-right">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {optimisticRows.map((row) => {
              const isPending = pendingCheckIds.includes(row.id);
              return (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                  </td>
                  <td className="px-3 py-2">{row.sites?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === "present" ? "حاضر" : row.status === "absent" ? "غائب" : "نصف يوم"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDecision(row.id, "confirm")}
                        className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                        disabled={isPending}
                      >
                        اعتماد
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecision(row.id, "reject")}
                        className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                        disabled={isPending}
                      >
                        رفض
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {optimisticRows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات اعتماد معلقة.</div>
      )}
    </Card>
  );
}

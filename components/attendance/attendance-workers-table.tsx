"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type { WorkerRow } from "@/lib/types/db";

type AttendanceStatus = "present" | "absent" | "half";

type Props = {
  rows: WorkerRow[];
  action: (formData: FormData) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
  workDate: string;
  initialStatusMap?: Record<number, AttendanceStatus>;
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

export function AttendanceWorkersTable({
  rows,
  action,
  bulkAction,
  workDate,
  initialStatusMap = {},
}: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [statusMap, setStatusMap] = useState<Record<number, AttendanceStatus>>(initialStatusMap);
  const [pendingWorkerIds, setPendingWorkerIds] = useState<number[]>([]);
  const [bulkPending, setBulkPending] = useState(false);

  const allIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = allIds.length > 0 && selected.length === allIds.length;

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === allIds.length ? [] : allIds));
  }

  function bulkButtons() {
    async function onBulk(status: AttendanceStatus) {
      if (selected.length === 0 || bulkPending) return;
      setBulkPending(true);
      setPendingWorkerIds((prev) => Array.from(new Set([...prev, ...selected])));
      setStatusMap((prev) => {
        const next = { ...prev };
        selected.forEach((id) => {
          next[id] = status;
        });
        return next;
      });

      const fd = new FormData();
      fd.set("workDate", workDate);
      fd.set("status", status);
      fd.set("workerIds", JSON.stringify(selected));
      try {
        await bulkAction(fd);
      } finally {
        setPendingWorkerIds((prev) => prev.filter((id) => !selected.includes(id)));
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

      const fd = new FormData();
      fd.set("workerId", String(workerId));
      fd.set("workDate", workDate);
      fd.set("status", status);
      try {
        await action(fd);
      } finally {
        setPendingWorkerIds((prev) => prev.filter((id) => id !== workerId));
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
        <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          تحديد الكل ({selected.length}/{rows.length})
        </label>
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
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
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

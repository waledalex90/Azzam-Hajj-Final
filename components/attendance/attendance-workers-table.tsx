"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import type { WorkerRow } from "@/lib/types/db";

type Props = {
  rows: WorkerRow[];
  action: (formData: FormData) => Promise<void>;
  bulkAction: (formData: FormData) => Promise<void>;
  workDate: string;
};

export function AttendanceWorkersTable({ rows, action, bulkAction, workDate }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const allIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const allSelected = allIds.length > 0 && selected.length === allIds.length;

  function toggle(id: number) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  }

  function toggleAll() {
    setSelected((prev) => (prev.length === allIds.length ? [] : allIds));
  }

  function bulkButtons() {
    return (
      <form action={bulkAction} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="workDate" value={workDate} />
        <input type="hidden" name="workerIds" value={JSON.stringify(selected)} />
        <button
          type="submit"
          name="status"
          value="present"
          className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0}
        >
          تحضير المحدد كـ حاضر
        </button>
        <button
          type="submit"
          name="status"
          value="absent"
          className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0}
        >
          تحضير المحدد كـ غائب
        </button>
        <button
          type="submit"
          name="status"
          value="half"
          className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-40"
          disabled={selected.length === 0}
        >
          تحضير المحدد كنصف يوم
        </button>
      </form>
    );
  }

  const statusButtons = (workerId: number) => (
    <div className="flex flex-wrap items-center gap-2">
      <form action={action}>
        <input type="hidden" name="workerId" value={workerId} />
        <input type="hidden" name="workDate" value={workDate} />
        <input type="hidden" name="status" value="present" />
        <button type="submit" className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-bold text-white">
          حاضر
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="workerId" value={workerId} />
        <input type="hidden" name="workDate" value={workDate} />
        <input type="hidden" name="status" value="absent" />
        <button type="submit" className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white">
          غائب
        </button>
      </form>
      <form action={action}>
        <input type="hidden" name="workerId" value={workerId} />
        <input type="hidden" name="workDate" value={workDate} />
        <input type="hidden" name="status" value="half" />
        <button type="submit" className="rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-bold text-white">
          نصف
        </button>
      </form>
    </div>
  );

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

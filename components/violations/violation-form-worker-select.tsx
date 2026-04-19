"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import type { WorkerRow } from "@/lib/types/db";

type Props = {
  workers: WorkerRow[];
  name?: string;
  required?: boolean;
  defaultWorkerId?: number;
};

function matches(w: WorkerRow, q: string) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return w.name.toLowerCase().includes(s) || (w.id_number && w.id_number.includes(s));
}

/** بحث فوري + قائمة اختيار (مثل فلاتر العمال) */
export function ViolationFormWorkerSelect({ workers, name = "workerId", required, defaultWorkerId }: Props) {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => workers.filter((w) => matches(w, q)), [workers, q]);

  return (
    <div className="space-y-2">
      <div>
        <label className="text-xs font-bold text-slate-700">بحث فوري عن العامل</label>
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="اسم أو رقم هوية…"
          className="mt-1"
          autoComplete="off"
        />
        <p className="mt-0.5 text-xs text-slate-500">
          يظهر {filtered.length} من أصل {workers.length}
        </p>
      </div>
      <select
        name={name}
        className="min-h-12 w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-base"
        required={required}
        defaultValue={defaultWorkerId && workers.some((w) => w.id === defaultWorkerId) ? defaultWorkerId : ""}
      >
        <option value="" disabled>
          اختر العامل
        </option>
        {filtered.map((worker) => (
          <option key={worker.id} value={worker.id}>
            {worker.name} - {worker.id_number}
          </option>
        ))}
      </select>
    </div>
  );
}

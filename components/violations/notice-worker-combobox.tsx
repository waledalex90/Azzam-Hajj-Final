"use client";

import { useMemo, useState } from "react";

import type { WorkerRow } from "@/lib/types/db";

type Props = {
  workers: WorkerRow[];
  name?: string;
  required?: boolean;
  disabled?: boolean;
  onPickWorker?: (worker: WorkerRow) => void;
  initialWorkerId?: string;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

/** حقل عامل واحد: الكتابة بحث، اختيار من القائمة */
export function NoticeWorkerCombobox({
  workers,
  name = "workerId",
  required,
  disabled,
  onPickWorker,
  initialWorkerId,
}: Props) {
  const workerMap = useMemo(() => {
    const m = new Map<number, WorkerRow>();
    workers.forEach((w) => m.set(w.id, w));
    return m;
  }, [workers]);

  const seed = useMemo(() => {
    if (!initialWorkerId) return { text: "", selectedId: "" };
    const w = workerMap.get(Number(initialWorkerId));
    if (!w) return { text: "", selectedId: "" };
    return { text: `${w.name} — ${w.id_number ?? ""}`, selectedId: String(w.id) };
  }, [initialWorkerId, workerMap]);

  const [text, setText] = useState(seed.text);
  const [selectedId, setSelectedId] = useState(seed.selectedId);
  const [open, setOpen] = useState(false);

  const filtered = useMemo(() => {
    const s = norm(text);
    if (!s) return workers.slice(0, 45);
    return workers
      .filter(
        (w) => norm(w.name).includes(s) || (w.id_number && w.id_number.toLowerCase().includes(s)),
      )
      .slice(0, 55);
  }, [workers, text]);

  function pick(w: WorkerRow) {
    setSelectedId(String(w.id));
    setText(`${w.name} — ${w.id_number}`);
    setOpen(false);
    onPickWorker?.(w);
  }

  if (disabled) {
    return <input className="border border-black bg-slate-50 px-2 py-1.5" readOnly value={text || "—"} />;
  }

  return (
    <div className="relative">
      <input
        type="text"
        autoComplete="off"
        dir="rtl"
        className="w-full border border-black bg-white px-2 py-1.5 text-sm font-semibold"
        placeholder="ابحث بالاسم أو رقم الهوية ثم اختر من القائمة"
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setSelectedId("");
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 160)}
      />
      <input type="hidden" name={name} value={selectedId} required={required} />
      {open && text.trim() && filtered.length === 0 && (
        <p className="absolute left-0 right-0 top-full z-40 border border-black border-t-0 bg-amber-50 px-2 py-2 text-xs text-amber-900">
          لا يوجد عامل مطابق في القائمة المحمّلة. غيّر البحث أو راجع بيانات العامل.
        </p>
      )}
      {open && filtered.length > 0 && (
        <ul className="absolute left-0 right-0 top-full z-40 max-h-48 overflow-y-auto border border-black border-t-0 bg-white shadow-md">
          {filtered.map((w) => (
            <li key={w.id}>
              <button
                type="button"
                className="w-full px-2 py-2 text-right text-sm hover:bg-emerald-50"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(w);
                }}
              >
                {w.name} — {w.id_number}
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-0.5 text-[11px] text-slate-600">قائمة العمال النشطين المتاحة للاختيار: {workers.length}</p>
    </div>
  );
}

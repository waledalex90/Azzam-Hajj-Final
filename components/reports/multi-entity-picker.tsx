"use client";

import { useCallback, useEffect, useState } from "react";

import { searchReportEntitiesAction } from "@/app/(dashboard)/reports/actions";
import clsx from "clsx";

type Kind = "site" | "contractor" | "supervisor";

type Row = { id: number; name: string; subtitle: string };

type Props = {
  kind: Kind;
  label: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

export function MultiEntityPicker({ kind, label, selectedIds, onChange }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameById, setNameById] = useState<Record<number, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await searchReportEntitiesAction(kind, debounced);
      setResults(rows.map((r) => ({ id: r.id, name: r.name, subtitle: r.subtitle })));
    } finally {
      setLoading(false);
    }
  }, [kind, debounced]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedSet = new Set(selectedIds);

  const toggle = (id: number, name?: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      if (name) {
        setNameById((prev) => ({ ...prev, [id]: name }));
      }
    }
    onChange(Array.from(next).sort((a, b) => a - b));
  };

  useEffect(() => {
    setNameById((prev) => {
      let changed = false;
      const n = { ...prev };
      for (const r of results) {
        if (selectedIds.includes(r.id) && !n[r.id]) {
          n[r.id] = r.name;
          changed = true;
        }
      }
      return changed ? n : prev;
    });
  }, [results, selectedIds]);

  return (
    <div className="relative flex flex-col gap-1">
      <p className="text-xs font-bold text-slate-700">{label}</p>
      <div className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-2">
        {selectedIds.length === 0 ? (
          <span className="text-xs text-slate-400">الكل (لا فلتر)</span>
        ) : (
          selectedIds.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-900"
            >
              {nameById[id] ?? `#${id}`} ×
            </button>
          ))
        )}
      </div>
      <input
        type="search"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => setQ(e.target.value)}
        placeholder="بحث بالاسم…"
        className="min-h-10 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        autoComplete="off"
      />
      {open && (
        <div className="absolute top-full z-20 mt-1 max-h-52 w-full overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
          {loading && <div className="p-2 text-xs text-slate-500">بحث…</div>}
          {!loading &&
            results.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  toggle(r.id, r.name);
                }}
                className={clsx(
                  "flex w-full flex-col items-start border-b border-slate-100 px-3 py-2 text-right text-sm hover:bg-slate-50",
                  selectedSet.has(r.id) && "bg-emerald-50",
                )}
              >
                <span className="font-bold text-slate-800">{r.name}</span>
                <span className="text-[10px] text-slate-500">{r.subtitle}</span>
              </button>
            ))}
          {!loading && results.length === 0 && (
            <div className="p-2 text-xs text-slate-500">لا نتائج</div>
          )}
        </div>
      )}
      <button
        type="button"
        className="text-xs text-slate-500 underline"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? "إغلاق القائمة" : "عرض القائمة"}
      </button>
    </div>
  );
}

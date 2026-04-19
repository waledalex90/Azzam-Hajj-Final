"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { searchReportEntitiesAction } from "@/app/(dashboard)/reports/actions";
import clsx from "clsx";
import { ChevronDown, Search, X } from "lucide-react";

type Kind = "site" | "contractor" | "supervisor";

type Row = { id: number; name: string; subtitle: string };

type Props = {
  kind: Kind;
  label: string;
  selectedIds: number[];
  onChange: (ids: number[]) => void;
};

const MAX_TAGS_INLINE = 4;

/**
 * فلتر متعدد: Combobox + بحث فوري + وسوم في سطر واحد (تقارير).
 */
export function MultiEntityPicker({ kind, label, selectedIds, onChange }: Props) {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<Row[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [nameById, setNameById] = useState<Record<number, string>>({});
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

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

  const visibleTags = selectedIds.slice(0, MAX_TAGS_INLINE);
  const overflow = Math.max(0, selectedIds.length - MAX_TAGS_INLINE);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <p className="mb-1 text-xs font-bold text-slate-700">{label}</p>
      <div
        role="button"
        tabIndex={0}
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-right shadow-sm"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((o) => !o);
          }
        }}
      >
        <div className="flex min-w-0 flex-1 flex-nowrap items-center gap-1 overflow-hidden">
          {selectedIds.length === 0 ? (
            <span className="truncate text-xs text-slate-400">الكل (لا فلتر)</span>
          ) : (
            <>
              {visibleTags.map((id) => (
                <span
                  key={id}
                  className="inline-flex max-w-[7rem] shrink-0 items-center gap-0.5 truncate rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900"
                  title={nameById[id] ?? `#${id}`}
                >
                  <span className="truncate">{nameById[id] ?? `#${id}`}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded p-0.5 hover:bg-emerald-200"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(id);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              {overflow > 0 && (
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  +{overflow}
                </span>
              )}
            </>
          )}
        </div>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </div>

      {open && (
        <div className="absolute top-full z-50 mt-1 flex max-h-64 w-full min-w-[min(100%,18rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث بالاسم…"
              className="min-h-9 w-full border-0 bg-transparent text-sm outline-none"
              autoComplete="off"
              autoFocus
            />
          </div>
          <div className="overflow-y-auto">
            {loading && <div className="p-2 text-xs text-slate-500">بحث…</div>}
            {!loading &&
              results.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => toggle(r.id, r.name)}
                  className={clsx(
                    "flex w-full flex-col items-start border-b border-slate-50 px-3 py-2 text-right text-sm hover:bg-slate-50",
                    selectedSet.has(r.id) && "bg-emerald-50",
                  )}
                >
                  <span className="flex w-full items-center justify-between gap-2">
                    <span className="font-bold text-slate-800">{r.name}</span>
                    {selectedSet.has(r.id) && (
                      <span className="text-[10px] font-bold text-emerald-700">✓</span>
                    )}
                  </span>
                  <span className="text-[10px] text-slate-500">{r.subtitle}</span>
                </button>
              ))}
            {!loading && results.length === 0 && (
              <div className="p-2 text-xs text-slate-500">لا نتائج</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

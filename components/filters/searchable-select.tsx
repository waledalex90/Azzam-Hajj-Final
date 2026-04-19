"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown, Search } from "lucide-react";

export type SearchableOption = { id: string; label: string };

/**
 * قائمة منسدلة واحدة مع بحث نصي (للبصمة، Horizontal Report، إلخ).
 */
export function SearchableSelect({
  label,
  value,
  onChange,
  options,
  emptyLabel = "الكل",
  className,
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  options: SearchableOption[];
  emptyLabel?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t));
  }, [options, q]);

  const display =
    value === "" ? emptyLabel : (options.find((o) => o.id === value)?.label ?? `#${value}`);

  return (
    <div ref={rootRef} className={clsx("relative", className)}>
      <p className="mb-1 text-xs font-bold text-slate-700">{label}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-right text-sm font-bold text-slate-900 shadow-sm disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="min-w-0 flex-1 truncate">{display}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-500" />
      </button>
      {open && (
        <div className="absolute top-full z-50 mt-1 flex max-h-64 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="بحث…"
              className="min-h-9 w-full border-0 bg-transparent text-sm outline-none"
              autoComplete="off"
            />
          </div>
          <div className="overflow-y-auto">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setQ("");
              }}
              className="w-full border-b border-slate-50 px-3 py-2 text-right text-sm hover:bg-slate-50"
            >
              {emptyLabel}
            </button>
            {filtered.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => {
                  onChange(o.id);
                  setOpen(false);
                  setQ("");
                }}
                className={clsx(
                  "w-full border-b border-slate-50 px-3 py-2 text-right text-sm hover:bg-emerald-50",
                  value === o.id && "bg-emerald-50 font-bold",
                )}
              >
                {o.label}
              </button>
            ))}
            {!filtered.length && <div className="px-3 py-2 text-xs text-slate-500">لا نتائج</div>}
          </div>
        </div>
      )}
    </div>
  );
}

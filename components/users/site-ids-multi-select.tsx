"use client";

import { useMemo, useState } from "react";

import { X } from "lucide-react";

export type SiteOption = { id: number; name: string };

function normalizeIds(ids: number[] | null | undefined): number[] {
  return [...new Set((ids ?? []).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
}

type Props = {
  sites: SiteOption[];
  /** عند فتح التعديل: المواقع الحالية للمستخدم */
  initialSelectedIds?: number[] | null;
  /** تسمية الحقل */
  label: string;
  /** نص توضيحي تحت الحقل */
  hint?: string;
};

/**
 * اختيار متعدد للمواقع: وسوم قابلة للإزالة + قائمة لإضافة موقع.
 * يُرسل عبر عدة حقول مخفية `allowedSiteIds` (مصفوفة في FormData).
 */
export function SiteIdsMultiSelect({ sites, initialSelectedIds, label, hint }: Props) {
  const [selected, setSelected] = useState<number[]>(() => normalizeIds(initialSelectedIds ?? undefined));

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const available = useMemo(
    () => sites.filter((s) => !selectedSet.has(s.id)).sort((a, b) => a.name.localeCompare(b.name, "ar")),
    [sites, selectedSet],
  );

  function remove(id: number) {
    setSelected((prev) => prev.filter((x) => x !== id));
  }

  function addFromSelect(value: string) {
    const id = Number(value);
    if (!Number.isFinite(id) || id <= 0) return;
    setSelected((prev) => normalizeIds([...prev, id]));
  }

  return (
    <div className="space-y-2">
      <label className="text-xs font-bold text-slate-600">{label}</label>

      <div className="min-h-11 rounded-lg border border-slate-200 bg-white px-2 py-2 shadow-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          {selected.length === 0 ? (
            <span className="text-xs text-slate-400">الكل (لا قيود على المواقع)</span>
          ) : (
            selected.map((id) => {
              const name = sites.find((s) => s.id === id)?.name ?? `#${id}`;
              return (
                <span
                  key={id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-950"
                  title={name}
                >
                  <span className="truncate">{name}</span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-0.5 text-emerald-800 hover:bg-emerald-200/80"
                    onClick={() => remove(id)}
                    aria-label={`إزالة ${name}`}
                  >
                    <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                  </button>
                </span>
              );
            })
          )}
        </div>

        <div className="mt-2 border-t border-slate-100 pt-2">
          <select
            className="w-full min-h-9 rounded-md border border-slate-200 bg-slate-50 px-2 text-xs text-slate-800"
            value=""
            onChange={(e) => {
              addFromSelect(e.target.value);
              e.target.value = "";
            }}
            aria-label="إضافة موقع"
          >
            <option value="">+ إضافة موقع…</option>
            {available.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.name}
              </option>
            ))}
          </select>
          {sites.length === 0 && (
            <p className="mt-1 text-[11px] text-amber-700">لا توجد مواقع في النظام بعد.</p>
          )}
        </div>
      </div>

      {hint && <p className="text-[11px] leading-relaxed text-slate-500">{hint}</p>}

      {selected.map((id) => (
        <input key={id} type="hidden" name="allowedSiteIds" value={String(id)} />
      ))}
    </div>
  );
}

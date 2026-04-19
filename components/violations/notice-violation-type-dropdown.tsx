"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Item = { id: number; name_ar: string };

type Props = {
  types: Item[];
  viewMode?: boolean;
  viewSelectedIds?: number[];
};

/**
 * شاشة: سطر واحد (زر يفتح قائمة عائمة) + تحته أسماء المختار فقط.
 * طباعة: نسخة `.only-print` بالأسماء فقط.
 */
export function NoticeViolationTypeDropdown({ types, viewMode, viewSelectedIds }: Props) {
  const viewLabels = useMemo(() => {
    if (!viewMode) return null;
    const ids = viewSelectedIds ?? [];
    return types.filter((t) => ids.includes(t.id));
  }, [types, viewMode, viewSelectedIds]);

  if (viewMode) {
    return (
      <div className="violation-type-block">
        <span className="mb-1 block font-extrabold">نوع/أنواع المخالفة:</span>
        <div className="violation-print-box">
          <ul className="violation-print-list">
            {(viewLabels ?? []).map((t) => (
              <li key={t.id} className="violation-print-li">
                ☑ {t.name_ar}
              </li>
            ))}
          </ul>
          {(viewLabels ?? []).length === 0 && <p className="violation-print-empty m-0">—</p>}
        </div>
      </div>
    );
  }

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function remove(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  const selectedItems = types.filter((t) => selected.has(t.id));
  const lineLabel =
    selected.size === 0 ? "اختر من القائمة…" : `${selected.size} نوع مختار — اضغط للتعديل`;

  return (
    <div className="violation-type-block">
      <div className="no-print">
        <span className="mb-1 block font-extrabold">اختر نوع/أنواع المخالفة:</span>

        <div ref={wrapRef} className="violation-picker-wrap">
          <button
            type="button"
            className="violation-picker-line"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="violation-picker-line-text">{lineLabel}</span>
            <span className="violation-picker-chevron" aria-hidden>
              ▾
            </span>
          </button>

          {open && (
            <div className="violation-picker-float" role="listbox">
              <div className="violation-picker-float-inner">
                {types.map((t) => (
                  <label key={t.id} className="violation-picker-row">
                    <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    <span>{t.name_ar}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {selectedItems.length > 0 && (
          <div className="violation-selected-below">
            <span className="violation-selected-title">المختار:</span>
            <ul className="violation-selected-ul">
              {selectedItems.map((t) => (
                <li key={t.id} className="violation-selected-li">
                  <span className="violation-selected-name">{t.name_ar}</span>
                  <button type="button" className="violation-selected-remove" onClick={() => remove(t.id)} aria-label="إزالة">
                    ×
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {Array.from(selected).map((id) => (
          <input key={id} type="hidden" name="violationTypeIds" value={id} />
        ))}
      </div>

      <div className="only-print violation-print-box">
        <p className="violation-print-title">أنواع المخالفة المسجّلة:</p>
        <ul className="violation-print-list">
          {types
            .filter((t) => selected.has(t.id))
            .map((t) => (
              <li key={t.id} className="violation-print-li">
                {t.name_ar}
              </li>
            ))}
        </ul>
        {selected.size === 0 && <p className="violation-print-empty">— لم يُختر نوع —</p>}
      </div>
    </div>
  );
}

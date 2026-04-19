"use client";

import { useMemo, useState } from "react";

type Item = { id: number; name_ar: string };

type Props = {
  types: Item[];
  /** عرض إشعار محفوظ */
  viewMode?: boolean;
  viewSelectedIds?: number[];
};

/** شاشة: قائمة منطوية (▾) + اختيار متعدد. طباعة: الأنواع المختارة فقط. */
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

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const summaryText =
    selected.size === 0
      ? "اضغط لفتح القائمة واختيار نوع المخالفة ▾"
      : `تم اختيار ${selected.size} نوع — اضغط للتعديل ▾`;

  return (
    <div className="violation-type-block">
      <div className="no-print">
        <span className="mb-1 block font-extrabold">اختر نوع/أنواع المخالفة:</span>
        <details className="violation-details">
          <summary className="violation-details-summary">{summaryText}</summary>
          <div className="violation-details-panel">
            {types.map((t) => (
              <label key={t.id} className="violation-details-row">
                <input type="checkbox" checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                <span>{t.name_ar}</span>
              </label>
            ))}
          </div>
        </details>
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

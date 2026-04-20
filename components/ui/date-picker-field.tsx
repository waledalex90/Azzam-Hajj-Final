"use client";

import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";
import { format, isValid, parseISO } from "date-fns";
import { arSA } from "date-fns/locale";
import { DayPicker } from "react-day-picker";
import "react-day-picker/style.css";

import calendarStyles from "./date-picker-calendar.module.css";

type Props = {
  name: string;
  /** فارغ = لا يوجد تاريخ مختار عند التحميل */
  defaultValue?: string;
  /** يُستدعى عند اختيار تاريخ (للتنقل الفوري بدون زر إرسال) */
  onCommitted?: (yyyyMmDd: string) => void;
  disabled?: boolean;
};

const PLACEHOLDER = "اختر التاريخ";

function parseInitial(value: string | undefined): Date | undefined {
  if (value == null || value.trim() === "") return undefined;
  const parsed = parseISO(value.trim());
  return isValid(parsed) ? parsed : undefined;
}

export function DatePickerField({ name, defaultValue = "", onCommitted, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Date | undefined>(() => parseInitial(defaultValue));

  const value = useMemo(
    () => (selected ? format(selected, "yyyy-MM-dd") : ""),
    [selected],
  );
  const label = useMemo(
    () => (selected ? format(selected, "PPP", { locale: arSA }) : PLACEHOLDER),
    [selected],
  );

  return (
    <div className="relative">
      <input type="hidden" name={name} value={value} />
      <button
        type="button"
        disabled={disabled}
        aria-label={PLACEHOLDER}
        onClick={() => {
          if (disabled) return;
          setOpen((prev) => !prev);
        }}
        className="flex min-h-12 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 text-right text-sm shadow-sm hover:border-[#166534] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "font-semibold text-slate-800" : "text-slate-400"}>{label}</span>
        <CalendarDays className="h-4 w-4 shrink-0 text-slate-500" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
          <div className={calendarStyles.wrap} dir="rtl">
            <DayPicker
              mode="single"
              selected={selected}
              onSelect={(date) => {
                if (!date) return;
                setSelected(date);
                setOpen(false);
                const iso = format(date, "yyyy-MM-dd");
                onCommitted?.(iso);
              }}
              locale={arSA}
              weekStartsOn={6}
            />
          </div>
          <button
            type="button"
            className="mt-2 w-full rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
            onClick={() => {
              const d = new Date();
              setSelected(d);
              setOpen(false);
              onCommitted?.(format(d, "yyyy-MM-dd"));
            }}
          >
            اختيار تاريخ اليوم
          </button>
        </div>
      )}
    </div>
  );
}

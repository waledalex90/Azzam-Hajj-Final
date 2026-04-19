"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { clsx } from "clsx";

export type NoticeModeRecentItem = {
  id: number;
  noticeNo: string;
  workerName: string;
  contractorName: string;
};

type Props = {
  isViewMode: boolean;
  recent: NoticeModeRecentItem[];
};

/** أعلى الصفحة: [ جديد ] إصدار إشعار | [ عرض ▾ ] فتح إشعار محفوظ */
export function NoticeModeBar({ isViewMode, recent }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="no-print rounded-xl border-2 border-slate-300 bg-white shadow-sm">
      <p className="border-b border-slate-200 px-3 py-2 text-center text-sm font-extrabold text-slate-800">
        نوع الشاشة
      </p>
      <div className="grid grid-cols-1 gap-0 sm:grid-cols-2">
        <Link
          href="/violations/notice"
          className={clsx(
            "flex min-h-[52px] items-center justify-center px-4 py-3 text-center text-base font-extrabold transition-colors",
            !isViewMode ? "bg-[#166534] text-white hover:bg-[#14532d]" : "bg-slate-50 text-slate-800 hover:bg-slate-100",
          )}
        >
          جديد — إصدار إشعار مخالفة
        </Link>

        <div ref={wrapRef} className="relative border-t border-slate-200 sm:border-t-0 sm:border-r-0">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className={clsx(
              "flex min-h-[52px] w-full items-center justify-center gap-2 px-4 py-3 text-center text-base font-extrabold transition-colors",
              isViewMode ? "bg-[#166534] text-white hover:bg-[#14532d]" : "bg-[#f5efda] text-[#14532d] hover:bg-[#eee2be]",
            )}
          >
            عرض — إشعار محفوظ سابق
            <span className="text-lg leading-none" aria-hidden>
              ▾
            </span>
          </button>
          {open && (
            <div className="absolute left-0 right-0 top-full z-50 max-h-72 overflow-y-auto border border-slate-200 bg-white shadow-lg">
              {recent.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-slate-600">لا توجد إشعارات مقاول مسجّلة بعد.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-sm">
                  {recent.map((n) => (
                    <li key={n.id}>
                      <Link
                        href={`/violations/notice?viewId=${n.id}`}
                        className="block px-3 py-2.5 text-right hover:bg-emerald-50"
                        onClick={() => setOpen(false)}
                      >
                        <span className="font-bold">إشعار {n.noticeNo}</span>
                        <span className="block text-xs text-slate-600">
                          {n.workerName} — {n.contractorName}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
      <p className="border-t border-slate-100 px-3 py-2 text-center text-xs text-slate-600">
        «جديد» لملء نموذج إشعار جديد. «عرض» لاختيار إشعار قديم للمراجعة أو الطباعة فقط.
      </p>
    </div>
  );
}

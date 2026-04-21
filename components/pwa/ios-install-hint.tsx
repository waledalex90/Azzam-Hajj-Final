"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "azzam-pwa-ios-hint-dismissed";

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  if (nav.standalone === true) return true;
  return window.matchMedia("(display-mode: standalone)").matches;
}

export function IosInstallHint() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isIos() || isStandalone()) return;
    try {
      if (sessionStorage.getItem(STORAGE_KEY) === "1") return;
    } catch {
      /* ignore */
    }
    setOpen(true);
  }, []);

  function dismiss() {
    setOpen(false);
    try {
      sessionStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }

  if (!open) return null;

  return (
    <div
      role="region"
      aria-label="إضافة التطبيق للشاشة الرئيسية"
      className="fixed bottom-0 left-0 right-0 z-[100] border-t border-[#d4af37]/40 bg-[#0b0b0c] px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] text-center text-sm text-[#f8fafc] shadow-[0_-8px_32px_rgba(0,0,0,0.35)]"
    >
      <p className="font-extrabold text-[#f6e5a8]">تثبيت التطبيق على الآيفون</p>
      <p className="mt-1.5 leading-relaxed text-[13px] text-slate-200">
        اضغط زر <span className="font-bold text-white">مشاركة Share</span> أسفل شريط سفاري، ثم اختر{" "}
        <span className="font-bold text-[#d4af37]">إضافة إلى الشاشة الرئيسية</span>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="mt-2 text-xs font-bold text-[#d4af37] underline decoration-[#d4af37]/50 underline-offset-2"
      >
        فهمت، إخفاء
      </button>
    </div>
  );
}

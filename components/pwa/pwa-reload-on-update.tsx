"use client";

import { useEffect, useRef } from "react";

const RELOAD_COOLDOWN_MS = 12_000;
const LAST_RELOAD_KEY = "azzam-pwa-sw-last-reload";

/**
 * عند نشر نسخة جديدة، الـ Service Worker يتفعّل لكن الصفحة المفتوحة تبقى على كود قديم.
 * نعيد تحميل الصفحة مرة واحدة تلقائياً عند استلام تحكّم من worker جديد (بعد أول تثبيت).
 * عند العودة للتبويب/التطبيق نطلب فحص تحديث — مفيد على الموبايل ووضع PWA.
 *
 * حماية من التكرار: قفل محلي + حد أدنى للوقت بين عمليات reload في نفس الجلسة.
 */
export function PwaReloadOnUpdate() {
  const sawControllerBeforeChange = useRef(false);
  const reloadScheduled = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    const hadControllerOnLoad = !!navigator.serviceWorker.controller;
    sawControllerBeforeChange.current = hadControllerOnLoad;

    function withinCooldown(): boolean {
      try {
        const raw = sessionStorage.getItem(LAST_RELOAD_KEY);
        if (!raw) return false;
        const t = Number(raw);
        return Number.isFinite(t) && Date.now() - t < RELOAD_COOLDOWN_MS;
      } catch {
        return false;
      }
    }

    function reloadOnce(): void {
      if (reloadScheduled.current) return;
      if (withinCooldown()) return;
      reloadScheduled.current = true;
      try {
        sessionStorage.setItem(LAST_RELOAD_KEY, String(Date.now()));
      } catch {
        /* ignore */
      }
      window.location.reload();
    }

    const onControllerChange = () => {
      if (!sawControllerBeforeChange.current) {
        sawControllerBeforeChange.current = true;
        return;
      }
      reloadOnce();
    };

    navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    let onVisible: (() => void) | undefined;
    void navigator.serviceWorker.ready.then((reg) => {
      onVisible = () => {
        if (document.visibilityState === "visible") void reg.update();
      };
      document.addEventListener("visibilitychange", onVisible);
    });

    return () => {
      navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return null;
}

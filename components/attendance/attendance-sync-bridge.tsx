"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

import { useAttendanceRscRefreshLock } from "@/components/attendance/attendance-rsc-refresh-lock";

/** بعد آخر حدث بـ DEBOUNCE_MS — يقلّل عواصف التحديث عند التحضير الجماعي. */
const DEBOUNCE_MS = 450;
/** انتظار انتهاء حفظ التحضير قبل router.refresh (حد أقصى للمحاولات). */
const LOCK_POLL_MS = 150;
const LOCK_POLL_MAX_ATTEMPTS = 80;

/**
 * يبقى mounted في صفحة /attendance لكي يستمع لتغييرات attendance_checks
 * (إدراج/تحديث) ويعيد جلب الـ RSC — فيُحدَّث تبويب التحضير وتبويب المراجعة عند التبديل أو أثناء البقاء على الصفحة.
 */
export function AttendanceSyncBridge() {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockCtx = useAttendanceRscRefreshLock();

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();

    const scheduleRefresh = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        let attempts = 0;
        const tryRefresh = () => {
          if (lockCtx?.blockRscRefreshRef.current && attempts < LOCK_POLL_MAX_ATTEMPTS) {
            attempts += 1;
            debounceRef.current = setTimeout(tryRefresh, LOCK_POLL_MS);
            return;
          }
          router.refresh();
        };
        tryRefresh();
      }, DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("attendance_checks_live")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "attendance_checks" },
        scheduleRefresh,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "attendance_checks" },
        scheduleRefresh,
      )
      .subscribe();

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      void supabase.removeChannel(channel);
    };
  }, [router, lockCtx]);

  return null;
}

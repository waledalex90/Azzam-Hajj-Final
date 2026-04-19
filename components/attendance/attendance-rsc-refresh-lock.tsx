"use client";

import { createContext, useContext, useMemo, useRef, type ReactNode } from "react";

type Ctx = { blockRscRefreshRef: React.MutableRefObject<boolean> };

const AttendanceRscRefreshLockContext = createContext<Ctx | null>(null);

/** يمنع AttendanceSyncBridge من استدعاء router.refresh أثناء حفظ التحضير حتى لا يُعاد تحميل القائمة من السيرفر وتلغى التحديثات المحلية. */
export function AttendanceRscRefreshLockProvider({ children }: { children: ReactNode }) {
  const blockRscRefreshRef = useRef(false);
  const value = useMemo(() => ({ blockRscRefreshRef }), []);
  return (
    <AttendanceRscRefreshLockContext.Provider value={value}>
      {children}
    </AttendanceRscRefreshLockContext.Provider>
  );
}

export function useAttendanceRscRefreshLock(): Ctx | null {
  return useContext(AttendanceRscRefreshLockContext);
}

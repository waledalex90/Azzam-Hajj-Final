"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import styles from "./global-action-lock.module.css";

type RunLocked = <T>(fn: () => Promise<T>) => Promise<T>;

type Ctx = {
  runLocked: RunLocked;
  isLocked: boolean;
};

const GlobalActionLockContext = createContext<Ctx | null>(null);

export function GlobalActionLockProvider({ children }: { children: ReactNode }) {
  /**
   * طابور: العمليات تُنفَّذ بالتسلسل — يمنع طلبين متوازيين من نقرات مزدوجة على اللمس.
   * لا تستدعِ `runLocked` من داخل callback لـ `runLocked` (يؤدي إلى جمود).
   */
  const queueTailRef = useRef<Promise<void>>(Promise.resolve());
  const [isLocked, setIsLocked] = useState(false);

  const runLocked = useCallback<RunLocked>(async (fn) => {
    const prev = queueTailRef.current;
    let release!: () => void;
    queueTailRef.current = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    setIsLocked(true);
    try {
      return await fn();
    } finally {
      setIsLocked(false);
      release();
    }
  }, []);

  useEffect(() => {
    if (!isLocked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isLocked]);

  const value = useMemo(() => ({ runLocked, isLocked }), [runLocked, isLocked]);

  return (
    <GlobalActionLockContext.Provider value={value}>
      {children}
      {isLocked ? (
        <div
          className={styles.overlay}
          aria-busy="true"
          aria-live="polite"
          role="status"
          aria-label="جاري تنفيذ العملية، يرجى الانتظار"
        >
          <div className={styles.spinner} aria-hidden />
        </div>
      ) : null}
    </GlobalActionLockContext.Provider>
  );
}

/** داخل لوحة التحكم فقط — يفعّل طبقة منع النقر أثناء العمليات الطويلة */
export function useRunWithGlobalLock(): RunLocked {
  const ctx = useContext(GlobalActionLockContext);
  return useCallback<RunLocked>(
    async (fn) => (ctx ? ctx.runLocked(fn) : fn()),
    [ctx],
  );
}

"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RouteError = Error & { digest?: string; cause?: unknown };

type Props = {
  error: RouteError;
  reset: () => void;
  /** يظهر في السجلات فقط — مثال: Dashboard / users */
  boundaryLabel?: string;
};

/**
 * عرض أخطاء المسار مع تسجيل كامل في Production (Vercel Function Logs).
 * ملاحظة: Next.js قد يخفي message في واجهة العميل؛ digest يربطك بسجل السيرفر.
 */
export function RouteErrorDisplay({ error, reset, boundaryLabel = "Route" }: Props) {
  useEffect(() => {
    const err = error as RouteError;
    console.error(`[${boundaryLabel}] ErrorBoundary`, {
      message: err.message,
      name: err.name,
      digest: err.digest,
      stack: err.stack,
      cause: err.cause,
    });
    console.error(`[${boundaryLabel}] ErrorBoundary (raw):`, err);
  }, [error, boundaryLabel]);

  const digest = error.digest ?? "(لا يوجد digest)";
  const showMessage = error.message?.trim() || "لا توجد رسالة (قد تكون مخفية في الإنتاج — راجع السجلات).";

  return (
    <main className="mx-auto w-full max-w-[900px] p-6">
      <Card className="space-y-3 border-red-200 bg-red-50 p-4 text-right">
        <h1 className="text-xl font-extrabold text-red-900">تعذر تحميل الصفحة</h1>
        <p className="text-sm text-red-800">
          تفاصيل الخطأ أدناه (إن وُجدت). في الإنتاج قد تكون الرسالة عامة؛ استخدم <strong>digest</strong> لمطابقة سجل
          Vercel.
        </p>
        <div className="rounded-lg border border-red-200 bg-white p-3 text-left font-mono text-xs text-slate-900">
          <p className="break-words">
            <span className="font-sans font-bold text-slate-600">message: </span>
            {showMessage}
          </p>
          <p className="mt-2 break-all">
            <span className="font-sans font-bold text-slate-600">digest: </span>
            {digest}
          </p>
        </div>
        <p className="text-xs text-red-800">
          في سجلات السيرفر ابحث عن <code className="rounded bg-white px-1">[onRequestError]</code> بنفس الـ digest — هناك تظهر الرسالة
          الكاملة. ومن المتصفح: <code className="rounded bg-white px-1">console.error</code> أعلاه.
        </p>
        <div className="flex justify-center pt-2">
          <Button type="button" onClick={() => reset()}>
            إعادة المحاولة
          </Button>
        </div>
      </Card>
    </main>
  );
}

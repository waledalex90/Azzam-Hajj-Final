"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type RouteError = Error & { digest?: string; cause?: unknown };

type DiagnosticStep = {
  step: string;
  ok: boolean;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type DiagnosticPayload = {
  ok?: boolean;
  note?: string;
  error?: string;
  thrown?: string;
  stack?: string;
  usedFallbackColumns?: boolean;
  attemptedDetail?: string;
  steps?: DiagnosticStep[];
};

type Props = {
  error: RouteError;
  reset: () => void;
  /** يظهر في السجلات فقط — مثال: Dashboard / users */
  boundaryLabel?: string;
  /** يُجلب تلقائياً لعرض أخطاء Supabase الحقيقية (Route Handler لا يخفيها) */
  diagnosticUrl?: string;
};

/**
 * عرض أخطاء المسار مع تسجيل كامل في Production (Vercel Function Logs).
 * ملاحظة: Next.js قد يخفي message في واجهة العميل؛ digest يربطك بسجل السيرفر.
 */
export function RouteErrorDisplay({
  error,
  reset,
  boundaryLabel = "Route",
  diagnosticUrl = "/api/debug/users-management",
}: Props) {
  const [diagLoading, setDiagLoading] = useState(true);
  const [diagStatus, setDiagStatus] = useState<number | null>(null);
  const [diag, setDiag] = useState<DiagnosticPayload | null>(null);
  const [diagFetchErr, setDiagFetchErr] = useState<string | null>(null);

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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(diagnosticUrl, { credentials: "same-origin", cache: "no-store" });
        const text = await res.text();
        let json: DiagnosticPayload;
        try {
          json = JSON.parse(text) as DiagnosticPayload;
        } catch {
          if (cancelled) return;
          setDiagStatus(res.status);
          setDiag({ error: text.slice(0, 800) });
          return;
        }
        if (cancelled) return;
        setDiagStatus(res.status);
        setDiag(json);
      } catch (e) {
        if (cancelled) return;
        setDiagFetchErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setDiagLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [diagnosticUrl]);

  const digest = error.digest ?? "(لا يوجد digest)";
  const showMessage = error.message?.trim() || "لا توجد رسالة (قد تكون مخفية في الإنتاج — راجع السجلات).";

  const failedSteps = diag?.steps?.filter((s) => !s.ok) ?? [];
  const hasFailureDetail = failedSteps.length > 0 || diag?.thrown;

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
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-950">
          <p className="font-extrabold">تشخيص Supabase (تلقائي، نفس الجلسة)</p>
          <p className="mt-1">
            رابط مباشر:{" "}
            <a
              href={diagnosticUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[11px] font-bold text-amber-900 underline break-all"
            >
              {diagnosticUrl}
            </a>
          </p>
          {diagLoading && <p className="mt-2 text-amber-800">جاري جلب نتيجة التشخيص…</p>}
          {diagFetchErr && (
            <p className="mt-2 text-red-800">
              تعذّر الجلب: <span className="font-mono">{diagFetchErr}</span>
            </p>
          )}
          {!diagLoading && diagStatus === 401 && (
            <p className="mt-2 text-amber-900">غير مسجّل — سجّل الدخول ثم أعد فتح الصفحة أو الرابط أعلاه.</p>
          )}
          {!diagLoading && diagStatus === 403 && (
            <p className="mt-2 text-amber-900">لا تملك صلاحية التشخيص (تحتاج إدارة مستخدمين أو أدوار).</p>
          )}
          {!diagLoading && diag?.error && diagStatus !== 401 && diagStatus !== 403 && (
            <pre className="mt-2 max-h-32 overflow-auto rounded border border-amber-300 bg-white p-2 text-left font-mono text-[10px] text-amber-950">
              {diag.error}
            </pre>
          )}
          {!diagLoading && diag && hasFailureDetail && (
            <div className="mt-2 space-y-2 rounded border border-red-200 bg-white p-2 text-left text-red-900">
              {diagStatus != null && diagStatus >= 400 && (
                <p className="text-[11px] font-bold">HTTP {diagStatus}</p>
              )}
              {diag.thrown && (
                <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px]">
                  {diag.thrown}
                  {diag.stack ? `\n${diag.stack}` : ""}
                </pre>
              )}
              {failedSteps.map((s) => (
                <div key={s.step} className="border-b border-red-100 pb-2 last:border-0">
                  <p className="font-bold">{s.step}</p>
                  {s.message && <p className="font-mono text-[11px] break-words">{s.message}</p>}
                  {s.code && (
                    <p className="text-[11px]">
                      code: <code>{s.code}</code>
                    </p>
                  )}
                  {s.details && <p className="text-[11px] opacity-90 break-words">{s.details}</p>}
                  {s.hint && <p className="text-[11px] opacity-90">{s.hint}</p>}
                </div>
              ))}
            </div>
          )}
          {!diagLoading && diag?.ok === true && diag.steps && diag.steps.length > 0 && (
            <p className="mt-2 text-emerald-900">
              استعلامات المستخدمين/الأدوار نجحت من جهة الخادم. إن استمر العطل فالمشكلة ليست في نفس استعلامات Supabase
              أعلاه — راجع الرابط JSON أو السجلات.
            </p>
          )}
          {diag?.note && <p className="mt-2 text-[11px] opacity-90">{diag.note}</p>}
        </div>
        <div className="flex justify-center pt-2">
          <Button type="button" onClick={() => reset()}>
            إعادة المحاولة
          </Button>
        </div>
      </Card>
    </main>
  );
}

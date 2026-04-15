"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

type Props = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function DashboardError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Dashboard boundary error:", error);
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-[900px] p-6">
      <Card className="space-y-3 text-center">
        <h1 className="text-xl font-extrabold text-slate-900">تعذر تحميل الصفحة</h1>
        <p className="text-sm text-slate-600">
          حدث خطأ غير متوقع أثناء تحميل البيانات. يمكنك إعادة المحاولة الآن.
        </p>
        <div className="flex justify-center">
          <Button onClick={reset}>إعادة المحاولة</Button>
        </div>
      </Card>
    </main>
  );
}

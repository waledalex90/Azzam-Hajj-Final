"use client";

import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";

/** تقسيم الحزمة: التقارير ثقيلة (جدول + معاينة) — لا تُحمَّل حتى فتح الصفحة */
export const ReportsHubLazy = dynamic(
  () => import("@/components/reports/reports-hub").then((m) => m.ReportsHub),
  {
    ssr: false,
    loading: () => (
      <Card className="p-6 text-center text-sm font-bold text-slate-600">جاري تحميل التقارير…</Card>
    ),
  },
);

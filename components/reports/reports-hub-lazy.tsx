"use client";

import dynamic from "next/dynamic";

import { Card } from "@/components/ui/card";

const ReportsHubDynamic = dynamic<{ canExportReports?: boolean }>(
  () => import("@/components/reports/reports-hub").then((m) => m.ReportsHub),
  {
    ssr: false,
    loading: () => (
      <Card className="p-6 text-center text-sm font-bold text-slate-600">جاري تحميل التقارير…</Card>
    ),
  },
);

/** تقسيم الحزمة: التقارير ثقيلة — لا تُحمَّل حتى فتح الصفحة */
export function ReportsHubLazy({ canExportReports }: { canExportReports: boolean }) {
  return <ReportsHubDynamic canExportReports={canExportReports} />;
}

"use client";

import dynamic from "next/dynamic";

import type { ReportsTab } from "@/app/(dashboard)/reports/actions";
import { Card } from "@/components/ui/card";

const ReportsHubDynamic = dynamic<{
  canViewTab: Record<ReportsTab, boolean>;
  canExportTab: Record<ReportsTab, boolean>;
  defaultTab: ReportsTab;
}>(
  () => import("@/components/reports/reports-hub").then((m) => m.ReportsHub),
  {
    ssr: false,
    loading: () => (
      <Card className="p-6 text-center text-sm font-bold text-slate-600">جاري تحميل التقارير…</Card>
    ),
  },
);

/** تقسيم الحزمة: التقارير ثقيلة — لا تُحمَّل حتى فتح الصفحة */
export function ReportsHubLazy(props: {
  canViewTab: Record<ReportsTab, boolean>;
  canExportTab: Record<ReportsTab, boolean>;
  defaultTab: ReportsTab;
}) {
  return <ReportsHubDynamic {...props} />;
}

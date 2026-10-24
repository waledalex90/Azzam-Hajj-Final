import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/layout/app-shell";
import { DashboardShell } from "@/components/providers/dashboard-shell";
import { Card } from "@/components/ui/card";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { getSessionContext } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

type Props = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: Props) {
  const { authUser, appUser, sessionError } = await getSessionContext();
  const demoMode = isDemoModeEnabled();

  if (!authUser) {
    if (sessionError) {
      return (
        <main className="container-mobile py-6">
          <Card className="space-y-2 border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-bold">تعذر تهيئة الجلسة. حاول تسجيل الدخول مرة أخرى.</p>
          </Card>
        </main>
      );
    }
    redirect("/login");
  }

  if (sessionError && authUser) {
    return (
      <main className="container-mobile py-6">
        <Card className="space-y-2 border-red-200 bg-red-50 p-4 text-sm text-red-900">
          <p className="font-bold">تعذر تحميل ملف المستخدم. تواصل مع مدير النظام.</p>
        </Card>
      </main>
    );
  }

  if (!appUser) {
    return (
      <main className="container-mobile py-6">
        <Card className="text-sm text-red-700">هذا الحساب غير مكتمل الإعداد داخل النظام.</Card>
      </main>
    );
  }

  return (
    <AppShell user={appUser} demo={demoMode}>
      <DashboardShell>{children}</DashboardShell>
    </AppShell>
  );
}

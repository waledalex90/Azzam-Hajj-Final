import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { LogoutButton } from "@/components/layout/logout-button";
import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { Card } from "@/components/ui/card";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { getSessionContext } from "@/lib/auth/session";

type Props = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: Props) {
  const { authUser, appUser } = await getSessionContext();
  const demoMode = isDemoModeEnabled();
  if (!authUser) {
    redirect("/login");
  }

  if (!appUser) {
    return (
      <main className="container-mobile py-6">
        <Card className="text-sm text-red-700">
          هذا الحساب غير مكتمل الإعداد داخل النظام. برجاء التواصل مع مدير النظام.
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      <AdminSidebar user={appUser} />
      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto w-full max-w-[1200px] space-y-4">
          <div className="no-print flex items-center justify-end">
            <LogoutButton />
          </div>
          {demoMode && (
            <Card className="no-print border-amber-300 bg-amber-50 text-amber-900">
              وضع التجربة المحلي مفعل: التعديلات هنا للعرض فقط.
            </Card>
          )}
          <SonnerToaster />
          {children}
        </div>
      </main>
    </div>
  );
}

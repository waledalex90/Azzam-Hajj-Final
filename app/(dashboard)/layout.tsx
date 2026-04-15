import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { LogoutButton } from "@/components/layout/logout-button";
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
          الحساب موجود في Authentication لكنه غير مربوط في جدول <code>app_users</code>.
        </Card>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-[#0b0b0c] lg:flex">
      <AdminSidebar user={appUser} />
      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto w-full max-w-[1200px] space-y-4">
          <div className="flex items-center justify-end">
            <LogoutButton />
          </div>
          {demoMode && (
            <Card className="border-[#d4af37] bg-[#1a1a1c] text-[#f6e5a8]">
              نسخة تجريبية محلية مفعلة: أي عمليات حفظ/تعديل/حذف لن تُكتب في قاعدة البيانات.
            </Card>
          )}
          {children}
        </div>
      </main>
    </div>
  );
}

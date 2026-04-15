import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { TopNav } from "@/components/layout/top-nav";
import { Card } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";

type Props = {
  children: ReactNode;
};

export default async function DashboardLayout({ children }: Props) {
  const { authUser, appUser } = await getSessionContext();
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
    <div className="min-h-screen">
      <TopNav user={appUser} />
      <main className="container-mobile py-5">{children}</main>
    </div>
  );
}

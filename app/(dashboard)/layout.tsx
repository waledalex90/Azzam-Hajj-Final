import type { ReactNode } from "react";
import { redirect } from "next/navigation";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { LogoutButton } from "@/components/layout/logout-button";
import { SonnerToaster } from "@/components/ui/sonner-toaster";
import { Card } from "@/components/ui/card";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { getSessionContext } from "@/lib/auth/session";

/** جلسة + كوكيز — لا تصيير ثابت لهذه الشجرة */
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
            <p className="font-extrabold">فشل تهيئة الجلسة (قبل تسجيل الدخول)</p>
            <pre className="max-h-[320px] overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{sessionError}</pre>
            <p className="text-xs opacity-90">
              تحقق من سجلات Vercel. المصادقة تستخدم <code className="rounded bg-white px-1">anon key</code>؛ تحميل{" "}
              <code className="rounded bg-white px-1">app_users</code> يستخدم <code className="rounded bg-white px-1">service role</code>{" "}
              ويتجاوز RLS.
            </p>
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
          <p className="font-extrabold">فشل تحميل ملف المستخدم (app_users / user_roles)</p>
          <pre className="max-h-[400px] overflow-auto whitespace-pre-wrap break-words font-mono text-xs">{sessionError}</pre>
          <p className="text-xs opacity-90">
            استعلامات <code className="rounded bg-white px-1">loadAppUserWithRole</code> تمر عبر{" "}
            <code className="rounded bg-white px-1">createSupabaseAdminClient()</code> (مفتاح الخدمة — يتجاوز RLS). إن رأيت
            permission denied فغالباً المفتاح أو الـ URL خاطئ، أو الجدول غير موجود.
          </p>
        </Card>
      </main>
    );
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

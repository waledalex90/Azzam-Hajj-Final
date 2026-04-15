import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionContext } from "@/lib/auth/session";

export default async function LoginPage() {
  const { authUser } = await getSessionContext();
  if (authUser) {
    redirect("/dashboard");
  }

  return (
    <main className="container-mobile flex min-h-screen items-center justify-center bg-slate-50 py-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm sm:p-6">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo priority className="w-[180px] sm:w-[220px]" />
          <h1 className="text-3xl font-black tracking-tight text-slate-900">نظام عزام للحج</h1>
          <p className="text-sm text-slate-600">تسجيل دخول آمن وسريع</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

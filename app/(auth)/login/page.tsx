import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { Card } from "@/components/ui/card";
import { getSessionContext } from "@/lib/auth/session";

export default async function LoginPage() {
  const { authUser } = await getSessionContext();
  if (authUser) {
    redirect("/dashboard");
  }

  return (
    <main className="container-mobile flex min-h-screen items-center justify-center py-8">
      <Card className="w-full max-w-md space-y-5 border-slate-200 bg-white/95 text-center shadow-lg backdrop-blur">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo priority className="w-[180px] sm:w-[220px]" />
          <h1 className="text-2xl font-extrabold text-[#166534]">نظام عزام للحج</h1>
          <p className="text-sm text-slate-500">تسجيل دخول آمن وسريع</p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}

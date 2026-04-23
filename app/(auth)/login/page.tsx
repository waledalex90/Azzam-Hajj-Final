import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultLandingPath } from "@/lib/auth/default-landing";
import { getSessionContext } from "@/lib/auth/session";

export default async function LoginPage() {
  const { authUser, appUser } = await getSessionContext();
  if (authUser && appUser) {
    redirect(getDefaultLandingPath(appUser));
  }
  if (authUser) {
    redirect("/dashboard");
  }

  return (
    <main className="container-mobile flex min-h-screen items-center justify-center bg-gradient-to-b from-[#020203] via-[#0a0a0a] to-[#050506] py-10">
      <div className="w-full max-w-md space-y-6 rounded-2xl border border-[#d4af37]/30 bg-[#0b0b0c] p-6 text-center shadow-[0_0_48px_-12px_rgba(212,175,55,0.2)] sm:p-7">
        <div className="flex flex-col items-center gap-4">
          <BrandLogo priority />
          <h1 className="text-3xl font-black tracking-tight text-[#f6e8b8]">نظام عزام للحج</h1>
          <p className="text-sm text-[#c4a85a]">تسجيل دخول آمن وسريع</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

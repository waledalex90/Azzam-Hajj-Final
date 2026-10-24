import { redirect } from "next/navigation";

import { BrandLogo } from "@/components/branding/brand-logo";
import { LoginForm } from "@/components/auth/login-form";
import { getDefaultLandingPath } from "@/lib/auth/default-landing";
import { getSessionContext } from "@/lib/auth/session";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from "@/lib/product";

export default async function LoginPage() {
  const { authUser, appUser } = await getSessionContext();
  if (authUser && appUser) {
    redirect(getDefaultLandingPath(appUser));
  }
  if (authUser) {
    redirect("/dashboard");
  }

  const demo = isDemoModeEnabled();

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0B1730] px-4 py-10">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        style={{
          background:
            "radial-gradient(900px 420px at 12% 10%, rgb(34 199 216 / 0.22), transparent 55%), radial-gradient(700px 380px at 90% 90%, rgb(37 99 235 / 0.28), transparent 50%)",
        }}
      />
      <div className="login-lux-card-animate relative z-10 w-full max-w-md rounded-3xl border border-white/10 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo priority preset="auth" />
          <h1 className="text-2xl font-bold tracking-tight text-[#0B1730] sm:text-3xl">{PRODUCT_NAME}</h1>
          <p className="text-sm text-slate-600">{PRODUCT_TAGLINE_AR}</p>
          {demo ? (
            <p className="rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-800">نسخة عرض Demo</p>
          ) : null}
        </div>
        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

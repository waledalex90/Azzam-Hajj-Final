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
    <main className="container-mobile flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#222325_0%,#0f0f11_42%,#050506_100%)] py-8">
      <Card className="w-full max-w-md space-y-5 border-[#b88b2f] bg-[#121214]/95 text-center shadow-lg backdrop-blur">
        <div className="flex flex-col items-center gap-3">
          <BrandLogo priority className="w-[180px] sm:w-[220px]" />
          <h1 className="text-2xl font-extrabold text-[#f6e5a8]">نظام عزام للحج</h1>
          <p className="text-sm text-[#c8c0ab]">تسجيل دخول آمن وسريع</p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}

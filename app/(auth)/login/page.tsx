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
      <Card className="w-full max-w-md space-y-4 border-[#d8c99a]">
        <div className="flex flex-col items-center gap-3 text-center">
          <BrandLogo priority className="w-[170px] sm:w-[210px]" />
          <h1 className="text-xl font-extrabold text-[#14532d]">نظام عزام للحج</h1>
          <p className="text-sm text-[#5b4a1f]">لوحة تحكم ميدانية سريعة وآمنة</p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}

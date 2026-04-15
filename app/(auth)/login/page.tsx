import { redirect } from "next/navigation";

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
      <Card className="w-full max-w-md space-y-4">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">نظام عزام للحج</h1>
          <p className="text-sm text-slate-500">نسخة Next.js - تسجيل الدخول</p>
        </div>
        <LoginForm />
      </Card>
    </main>
  );
}

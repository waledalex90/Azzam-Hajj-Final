import { redirect } from "next/navigation";
import Image from "next/image";

import { LoginForm } from "@/components/auth/login-form";
import { getSessionContext } from "@/lib/auth/session";

export default async function LoginPage() {
  const { authUser } = await getSessionContext();
  if (authUser) {
    redirect("/dashboard");
  }

  return (
    <main className="container-mobile flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_20%_20%,#1f2022_0%,#0e0f11_40%,#050506_100%)] py-8">
      <div className="login-lux-card-animate w-full max-w-md space-y-6 rounded-2xl border-2 border-[#d4af37] bg-[#0a0a0a] p-4 text-center shadow-[0_18px_42px_rgba(0,0,0,0.45)] backdrop-blur sm:p-5">
        <div className="login-lux-logo-animate flex flex-col items-center gap-3">
          <Image
            src="/icons/icon-512.svg"
            alt="Azzam Royal Icon"
            width={126}
            height={126}
            priority
            className="h-auto w-[96px] rounded-3xl border border-[#d4af37] shadow-[0_14px_34px_rgba(0,0,0,0.35)] sm:w-[118px]"
          />
          <h1 className="text-3xl font-black tracking-wide text-[#f6e5a8]">نظام عزام للحج</h1>
          <p className="text-sm text-[#c8c0ab]">بوابة الدخول الرسمية</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}

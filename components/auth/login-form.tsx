"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveLoginEmailForAuth } from "@/lib/auth/resolve-login-email";
import { env } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const domainHint = env.authEmailDomain;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const email = resolveLoginEmailForAuth(identifier, domainHint);
    if (!email) {
      setIsLoading(false);
      setError("أدخل اسم الدخول أو البريد.");
      return;
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    setIsLoading(false);
    if (loginError) {
      setError(loginError.message);
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-right">
      <div className="space-y-2">
        <label className="text-sm font-extrabold text-[#e8d4a8]" htmlFor="login-id">
          اسم الدخول أو الكود
        </label>
        <Input
          id="login-id"
          type="text"
          name="username"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder={`مثال: ahmed أو بريد كامل`}
          className="border-[#3d3420] bg-[#11100c] text-[#f5ecd8] placeholder:text-[#6a6048] focus:border-[#c9a227] focus:ring-[#c9a227]/20"
        />
        <p className="text-[11px] leading-relaxed text-[#9a8a60]">
          إذا لم يكن البريد كاملاً (بدون @)، يُكمَّل تلقائياً:{" "}
          <span className="font-mono font-bold text-[#c4a85a]">@{domainHint}</span>
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extrabold text-[#e8d4a8]" htmlFor="password">
          كلمة المرور
        </label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="********"
          className="border-[#3d3420] bg-[#11100c] text-[#f5ecd8] placeholder:text-[#6a6048] focus:border-[#c9a227] focus:ring-[#c9a227]/20"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-500/40 bg-red-950/50 p-2 text-sm text-red-200">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full py-2.5"
      >
        {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}

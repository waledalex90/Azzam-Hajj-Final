"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { resolveLoginEmailCandidates } from "@/lib/auth/resolve-login-email";
import { env } from "@/lib/env";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    const emails = resolveLoginEmailCandidates(identifier, env.authEmailDomain, env.authEmailDomainAliases);
    if (emails.length === 0) {
      setIsLoading(false);
      setError("أدخل اسم الدخول أو البريد.");
      return;
    }

    let lastError: string | null = null;
    for (const email of emails) {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (!loginError) {
        setIsLoading(false);
        router.replace("/dashboard");
        router.refresh();
        return;
      }
      lastError = "بيانات الدخول غير صحيحة.";
    }

    setIsLoading(false);
    setError(lastError ?? "تعذر تسجيل الدخول.");
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-right">
      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-800" htmlFor="login-id">
          اسم الدخول أو البريد
        </label>
        <Input
          id="login-id"
          type="text"
          name="username"
          autoComplete="username"
          required
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          placeholder="اسم المستخدم أو البريد"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-bold text-slate-800" htmlFor="password">
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
        />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">{error}</p>
      ) : null}

      <Button type="submit" disabled={isLoading} className="w-full py-2.5">
        {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}

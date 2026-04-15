"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

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
        <label className="text-sm font-extrabold text-slate-800" htmlFor="email">
          البريد الإلكتروني
        </label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="name@company.com"
          className="border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#166534] focus:ring-[#dcfce7]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extrabold text-slate-800" htmlFor="password">
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
          className="border-slate-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-[#166534] focus:ring-[#dcfce7]"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-200 bg-red-50 p-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full border border-[#166534] bg-[#166534] py-2.5 text-white hover:bg-[#14532d]"
      >
        {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}

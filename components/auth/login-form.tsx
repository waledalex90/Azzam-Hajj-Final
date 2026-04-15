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
        <label className="text-sm font-extrabold text-[#f6e5a8]" htmlFor="email">
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
          className="border-[#b88b2f] bg-[#17181a] text-[#f4ecd7] shadow-[0_0_0_1px_rgba(212,175,55,0.16),0_10px_22px_rgba(0,0,0,0.28)] placeholder:text-[#9f987f] transition-all duration-200 focus:border-[#d4af37] focus:ring-[#3a2d0f] focus:shadow-[0_0_0_1px_rgba(212,175,55,0.42),0_0_24px_rgba(212,175,55,0.24)]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-extrabold text-[#f6e5a8]" htmlFor="password">
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
          className="border-[#b88b2f] bg-[#17181a] text-[#f4ecd7] shadow-[0_0_0_1px_rgba(212,175,55,0.16),0_10px_22px_rgba(0,0,0,0.28)] placeholder:text-[#9f987f] transition-all duration-200 focus:border-[#d4af37] focus:ring-[#3a2d0f] focus:shadow-[0_0_0_1px_rgba(212,175,55,0.42),0_0_24px_rgba(212,175,55,0.24)]"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-[#7f1d1d] bg-[#2a1111]/85 p-2 text-sm text-[#fca5a5]">
          {error}
        </p>
      )}

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full border border-[#d4af37] bg-[#d4af37] py-2.5 text-[#0b0b0c] shadow-[0_10px_24px_rgba(212,175,55,0.26)] transition-all duration-200 hover:bg-[#e2c35b] hover:shadow-[0_12px_28px_rgba(212,175,55,0.34)]"
      >
        {isLoading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
      </Button>
    </form>
  );
}

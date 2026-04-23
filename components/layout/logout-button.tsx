"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function LogoutButton() {
  const router = useRouter();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      className="flex items-center gap-2 rounded-xl border border-[#3d3420] bg-[#11100c] px-3 py-2 text-sm font-bold text-[#e8d4a8] transition hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <LogOut className="h-4 w-4" />
      <span>{isSigningOut ? "جاري تسجيل الخروج..." : "تسجيل خروج"}</span>
    </button>
  );
}

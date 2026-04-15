"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { clsx } from "clsx";
import {
  BadgeCheck,
  BellRing,
  Building2,
  ClipboardList,
  FileBarChart2,
  FileWarning,
  Home,
  LogOut,
  MapPin,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  UserSquare2,
} from "lucide-react";

import { BrandLogo } from "@/components/branding/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types/db";
import { ROLE_LABELS } from "@/lib/constants/roles";

type Props = {
  user: AppUser;
};

const menuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: Home },
  { href: "/workers", label: "الموظفين", icon: Users },
  { href: "/sites", label: "المواقع", icon: MapPin },
  { href: "/contractors", label: "المقاولين", icon: Building2 },
  { href: "/attendance", label: "تسجيل الحضور", icon: ClipboardList },
  { href: "/approval", label: "اعتماد الحضور", icon: BadgeCheck },
  { href: "/transfers", label: "نقل الموظفين", icon: Truck },
  { href: "/reports", label: "التقارير", icon: FileBarChart2 },
  { href: "/corrections", label: "طلبات التعديل", icon: BellRing },
  { href: "/violations/notice", label: "إشعار المخالفة", icon: FileWarning },
  { href: "/users", label: "المستخدمين", icon: UserSquare2 },
  { href: "/roles", label: "الأدوار والصلاحيات", icon: ShieldCheck },
  { href: "/violations", label: "المخالفات", icon: UserCog },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ user }: Props) {
  const pathname = usePathname();
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
    <aside className="w-full border-b border-[#b88b2f] bg-[#0f0f11]/95 text-[#f4ecd7] backdrop-blur lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-l lg:border-[#b88b2f]">
      <div className="px-4 py-4">
        <BrandLogo className="w-[105px] sm:w-[120px]" />
        <div className="mt-3 border-t border-[#b88b2f] pt-3">
          <p className="text-xs font-extrabold text-[#f6e5a8]">{user.username}</p>
          <p className="mt-1 text-[11px] text-[#c8c0ab]">{ROLE_LABELS[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#b88b2f] bg-[#1a1a1c] px-3 py-2 text-sm font-bold text-[#f6e5a8] transition hover:border-[#d4af37] hover:bg-[#232325] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{isSigningOut ? "جاري تسجيل الخروج..." : "تسجيل خروج"}</span>
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <nav className="grid gap-1 px-3 pb-4">
        {menuItems.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "bg-[#d4af37] text-[#0b0b0c] shadow-sm"
                  : "text-[#d6cfba] hover:bg-[#1b1b1d] hover:text-[#f6e5a8]",
              )}
            >
              <span>{item.label}</span>
              <Icon className="h-4 w-4" />
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

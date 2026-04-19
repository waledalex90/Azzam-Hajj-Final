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
  Truck,
  UserCog,
  Users,
  UserSquare2,
} from "lucide-react";

import { BrandLogo } from "@/components/branding/brand-logo";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type { AppUser } from "@/lib/types/db";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";

type Props = {
  user: AppUser;
};

const menuItems = [
  /** الرئيسية متاحة لأي مستخدم مسجّل — تجنب قفل الحسابات قبل تحديث مصفوفة الصلاحيات */
  { href: "/dashboard", label: "الرئيسية", icon: Home, always: true as boolean },
  { href: "/workers", label: "الموظفين", icon: Users, perm: PERM.WORKERS },
  { href: "/sites", label: "المواقع", icon: MapPin, perm: PERM.SITES },
  { href: "/contractors", label: "المقاولين", icon: Building2, perm: PERM.CONTRACTORS },
  { href: "/attendance", label: "تسجيل الحضور", icon: ClipboardList, perm: PERM.PREP },
  { href: "/approval", label: "اعتماد الحضور", icon: BadgeCheck, perm: PERM.APPROVAL },
  { href: "/transfers", label: "نقل الموظفين", icon: Truck, perm: PERM.TRANSFERS },
  { href: "/reports", label: "التقارير", icon: FileBarChart2, perm: PERM.REPORTS },
  { href: "/corrections", label: "طلبات التعديل", icon: BellRing, perm: PERM.CORRECTIONS_SCREEN },
  { href: "/violations/notice", label: "إشعار المخالفة", icon: FileWarning, perm: PERM.VIOLATION_NOTICE },
  {
    href: "/users",
    label: "المستخدمون والأدوار",
    icon: UserSquare2,
    anyPerms: [PERM.USERS_MANAGE, PERM.ROLES_MANAGE] as const,
  },
  { href: "/violations", label: "المخالفات", icon: UserCog, perm: PERM.VIOLATIONS },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  if (href === "/users") return pathname === "/users" || pathname.startsWith("/users?");
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
    <aside className="w-full border-b border-slate-200 bg-white/95 text-slate-800 backdrop-blur lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-l lg:border-slate-200">
      <div className="px-4 py-4">
        <BrandLogo className="w-[105px] sm:w-[120px]" />
        <div className="mt-3 border-t border-amber-200 pt-3">
          <p className="text-xs font-extrabold text-slate-700">{user.username}</p>
          <p className="mt-1 text-[11px] text-slate-500">{user.roleLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span>{isSigningOut ? "جاري تسجيل الخروج..." : "تسجيل خروج"}</span>
          <LogOut className="h-4 w-4" />
        </button>
      </div>

      <nav className="grid gap-1 px-3 pb-4">
        {menuItems
          .filter((item) => {
            if ("always" in item && item.always) return true;
            if ("anyPerms" in item && item.anyPerms) {
              return item.anyPerms.some((p) => hasPermission(user, p));
            }
            if ("perm" in item && item.perm) {
              return hasPermission(user, item.perm);
            }
            return true;
          })
          .map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                active
                  ? "bg-emerald-50 text-emerald-700 shadow-sm"
                  : "text-slate-700 hover:bg-slate-50 hover:text-slate-900",
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

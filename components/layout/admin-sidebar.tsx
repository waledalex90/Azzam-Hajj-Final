"use client";

import { SpaLink } from "@/components/navigation/spa-link";
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
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import { ALL_REPORT_TAB_PERMISSIONS, PERM } from "@/lib/permissions/keys";

type Props = {
  user: AppUser;
};

const menuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: Home, anyOf: [PERM.VIEW_DASHBOARD] as const },
  { href: "/workers", label: "الموظفين", icon: Users, anyOf: [PERM.VIEW_WORKERS] as const },
  { href: "/sites", label: "المواقع", icon: MapPin, anyOf: [PERM.VIEW_SITES] as const },
  { href: "/contractors", label: "المقاولين", icon: Building2, anyOf: [PERM.VIEW_CONTRACTORS] as const },
  {
    href: "/attendance",
    label: "تسجيل الحضور",
    icon: ClipboardList,
    anyOf: [PERM.VIEW_ATTENDANCE, PERM.EDIT_ATTENDANCE] as const,
  },
  { href: "/approval", label: "اعتماد الحضور", icon: BadgeCheck, anyOf: [PERM.APPROVE_ATTENDANCE] as const },
  {
    href: "/transfers",
    label: "نقل الموظفين",
    icon: Truck,
    anyOf: [PERM.VIEW_TRANSFERS, PERM.MANAGE_TRANSFERS] as const,
  },
  { href: "/reports", label: "التقارير", icon: FileBarChart2, anyOf: [PERM.VIEW_REPORTS, ...ALL_REPORT_TAB_PERMISSIONS] as const },
  {
    href: "/corrections",
    label: "طلبات التعديل",
    icon: BellRing,
    anyOf: [PERM.VIEW_CORRECTIONS_QUEUE, PERM.PROCESS_CORRECTIONS] as const,
  },
  {
    href: "/violations/notice",
    label: "إشعار المخالفة",
    icon: FileWarning,
    anyOf: [PERM.CREATE_VIOLATION_NOTICE] as const,
  },
  {
    href: "/users",
    label: "المستخدمون والأدوار",
    icon: UserSquare2,
    anyPerms: [PERM.MANAGE_USERS, PERM.MANAGE_ROLES] as const,
  },
  {
    href: "/violations",
    label: "المخالفات",
    icon: UserCog,
    anyOf: [PERM.VIEW_VIOLATIONS, PERM.MANAGE_VIOLATIONS] as const,
  },
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
    <aside className="w-full border-b border-[#2a2110] bg-[#0a0a0a] text-[#e8d4a8] backdrop-blur lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-l lg:border-[#2a2110]">
      <div className="px-4 py-4">
        <BrandLogo />
        <div className="mt-3 border-t border-[#d4af37]/20 pt-3">
          <p className="text-xs font-extrabold text-[#f6e8b8]">{user.username}</p>
          <p className="mt-1 text-[11px] text-[#b8a050]">{user.roleLabel}</p>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={isSigningOut}
          className="mt-3 flex w-full items-center justify-between rounded-xl border border-[#3d3420] bg-[#11100c] px-3 py-2 text-sm font-bold text-[#e8d4a8] transition hover:border-red-500/50 hover:bg-red-950/40 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-60"
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
            if ("anyOf" in item && item.anyOf) {
              return hasAnyPermission(user, [...item.anyOf]);
            }
            return true;
          })
          .map((item) => {
            const active = isActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <SpaLink
                key={item.href}
                href={item.href}
                className={clsx(
                  "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-all duration-200",
                  active
                    ? "border border-[#d4af37]/35 bg-[#1a1508] text-[#f6e8b8] shadow-sm"
                    : "text-[#b8a878] hover:bg-[#12100a] hover:text-[#f0e0b0]",
                )}
              >
                <span>{item.label}</span>
                <Icon className="h-4 w-4" />
              </SpaLink>
            );
          })}
      </nav>
    </aside>
  );
}

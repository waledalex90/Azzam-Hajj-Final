"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import {
  BadgeCheck,
  BellRing,
  Building2,
  ClipboardList,
  FileBarChart2,
  FileWarning,
  Home,
  MapPin,
  ShieldCheck,
  Truck,
  UserCog,
  Users,
  UserSquare2,
} from "lucide-react";

import { BrandLogo } from "@/components/branding/brand-logo";
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

  return (
    <aside className="w-full border-b border-slate-200 bg-white/95 text-slate-800 backdrop-blur lg:min-h-screen lg:w-[260px] lg:border-b-0 lg:border-l lg:border-slate-200">
      <div className="px-4 py-4">
        <BrandLogo className="w-[105px] sm:w-[120px]" />
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-xs text-slate-700">{user.username}</p>
          <p className="mt-1 text-[11px] text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
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
                  ? "bg-[#eaf4ec] text-[#14532d] shadow-sm"
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

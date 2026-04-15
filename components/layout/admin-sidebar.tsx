"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";

import { BrandLogo } from "@/components/branding/brand-logo";
import type { AppUser } from "@/lib/types/db";
import { ROLE_LABELS } from "@/lib/constants/roles";

type Props = {
  user: AppUser;
};

const menuItems = [
  { href: "/dashboard", label: "الرئيسية", icon: "⌂" },
  { href: "/workers", label: "الموظفين", icon: "👷" },
  { href: "/sites", label: "المواقع", icon: "🏢" },
  { href: "/contractors", label: "المقاولين", icon: "🏗" },
  { href: "/attendance", label: "تسجيل الحضور", icon: "📝" },
  { href: "/approval", label: "اعتماد الحضور", icon: "✅" },
  { href: "/transfers", label: "نقل الموظفين", icon: "⇄" },
  { href: "/reports", label: "التقارير", icon: "📊" },
  { href: "/corrections", label: "طلبات التعديل", icon: "✎" },
  { href: "/violations/notice", label: "إشعار المخالفة", icon: "📄" },
  { href: "/users", label: "المستخدمين", icon: "👥" },
  { href: "/roles", label: "الأدوار والصلاحيات", icon: "🛡" },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === "/dashboard";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar({ user }: Props) {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-slate-200 bg-[#111318] text-slate-100 lg:min-h-screen lg:w-[248px] lg:border-b-0 lg:border-l lg:border-slate-800">
      <div className="px-4 py-4">
        <BrandLogo className="w-[105px] sm:w-[120px]" />
        <div className="mt-3 border-t border-slate-700 pt-3">
          <p className="text-xs text-slate-300">{user.username}</p>
          <p className="mt-1 text-[11px] text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
      </div>

      <nav className="grid gap-1 px-3 pb-4">
        {menuItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                "flex items-center justify-between rounded-md px-3 py-2 text-sm transition",
                active ? "bg-slate-100 text-slate-900" : "text-slate-300 hover:bg-slate-800",
              )}
            >
              <span>{item.label}</span>
              <span className="text-xs">{item.icon}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

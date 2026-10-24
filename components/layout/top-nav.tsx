import Link from "next/link";

import { BrandLogo } from "@/components/branding/brand-logo";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { PRODUCT_NAME, PRODUCT_TAGLINE_AR } from "@/lib/product";
import type { AppUser } from "@/lib/types/db";

type Props = {
  user: AppUser;
};

const links = [
  { href: "/dashboard", label: "الرئيسية", anyOf: [PERM.VIEW_DASHBOARD] as const },
  {
    href: "/attendance",
    label: "التحضير",
    anyOf: [PERM.VIEW_ATTENDANCE, PERM.RECORD_ATTENDANCE_PREP, PERM.EDIT_ATTENDANCE] as const,
  },
  {
    href: "/violations",
    label: "المخالفات",
    anyOf: [PERM.VIEW_VIOLATIONS, PERM.MANAGE_VIOLATIONS] as const,
  },
] as const;

export function TopNav({ user }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-mobile flex min-h-16 items-center justify-between gap-3 py-2.5">
        <div className="flex items-center gap-3">
          <BrandLogo preset="topNav" />
          <div>
            <p className="text-sm font-bold text-[#0B1730]">{PRODUCT_NAME}</p>
            <p className="text-xs text-slate-500">{user.roleLabel || PRODUCT_TAGLINE_AR}</p>
          </div>
        </div>
        <nav className="hidden items-center gap-4 text-sm font-bold text-[#2563EB] sm:flex">
          {links
            .filter((item) => hasAnyPermission(user, [...item.anyOf]))
            .map((item) => (
              <Link key={item.href} href={item.href} className="rounded-md px-2 py-1 hover:bg-slate-100">
                {item.label}
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}

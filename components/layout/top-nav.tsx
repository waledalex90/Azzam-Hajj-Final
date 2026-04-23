import Link from "next/link";

import { BrandLogo } from "@/components/branding/brand-logo";
import { hasAnyPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import type { AppUser } from "@/lib/types/db";

type Props = {
  user: AppUser;
};

const links = [
  { href: "/dashboard", label: "الرئيسية", anyOf: [PERM.VIEW_DASHBOARD] as const },
  { href: "/attendance", label: "التحضير", anyOf: [PERM.VIEW_ATTENDANCE, PERM.EDIT_ATTENDANCE] as const },
  {
    href: "/violations",
    label: "المخالفات",
    anyOf: [PERM.VIEW_VIOLATIONS, PERM.MANAGE_VIOLATIONS] as const,
  },
] as const;

export function TopNav({ user }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-[#d4af37]/25 bg-[#0a0a0a]/95 backdrop-blur">
      <div className="container-mobile flex min-h-16 items-center justify-between gap-3 py-2.5">
        <div className="flex items-center gap-3">
          <BrandLogo />
          <div>
            <p className="text-sm font-extrabold text-[#f6e8b8]">نظام عزام للحج</p>
            <p className="text-xs text-[#b8a050]">{user.roleLabel}</p>
          </div>
        </div>
        <nav className="hidden items-center gap-4 text-sm font-bold text-[#d4af37] sm:flex">
          {links
            .filter((item) => hasAnyPermission(user, [...item.anyOf]))
            .map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-2 py-1 text-[#e8d4a8] transition hover:bg-[#1a1508] hover:text-[#f6e8b8]"
              >
                {item.label}
              </Link>
            ))}
        </nav>
      </div>
    </header>
  );
}

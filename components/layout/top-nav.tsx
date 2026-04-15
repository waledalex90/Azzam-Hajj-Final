import Link from "next/link";

import type { AppUser } from "@/lib/types/db";
import { ROLE_LABELS } from "@/lib/constants/roles";

type Props = {
  user: AppUser;
};

const links = [
  { href: "/dashboard", label: "الرئيسية" },
  { href: "/attendance", label: "التحضير" },
  { href: "/violations", label: "المخالفات" },
];

export function TopNav({ user }: Props) {
  return (
    <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="container-mobile flex min-h-16 items-center justify-between gap-3 py-2">
        <div>
          <p className="text-sm font-bold text-slate-900">نظام عزام للحج</p>
          <p className="text-xs text-slate-500">{ROLE_LABELS[user.role]}</p>
        </div>
        <nav className="hidden items-center gap-4 text-sm font-bold text-slate-600 sm:flex">
          {links.map((item) => (
            <Link key={item.href} href={item.href} className="rounded-md px-2 py-1 hover:bg-slate-100">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

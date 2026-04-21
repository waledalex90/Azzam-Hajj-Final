"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, type MouseEvent, type ReactNode } from "react";
import { clsx } from "clsx";

type Props = {
  href: string;
  className?: string;
  children: ReactNode;
  prefetch?: boolean;
};

function sameDestination(href: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const next = new URL(href, window.location.origin);
    const cur = new URL(window.location.href);
    return next.pathname === cur.pathname && next.search === cur.search;
  } catch {
    return false;
  }
}

/**
 * تنقل داخلي عبر `router.push` داخل `startTransition` ليبقى الواجهة مستجيبة أثناء جلب RSC.
 * لا يعترض النقر مع مفاتيح التعديل أو `target` غير `_self`.
 */
export function SpaLink({ href, className, children, prefetch = true }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = e.currentTarget.getAttribute("target");
    if (target && target !== "_self") return;
    if (sameDestination(href)) return;
    e.preventDefault();
    startTransition(() => {
      router.push(href);
    });
  }

  return (
    <Link
      href={href}
      prefetch={prefetch}
      onClick={onClick}
      className={clsx(className, pending && "cursor-wait opacity-[0.88]")}
      aria-busy={pending}
    >
      {children}
    </Link>
  );
}

"use client";

import type { ReactNode } from "react";

import type { AppUser } from "@/lib/types/db";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";

type Props = {
  user: AppUser;
  /** صلاحية واحدة */
  perm?: string;
  /** أي صلاحية من القائمة (OR) */
  anyOf?: string[];
  children: ReactNode;
};

/**
 * يخفي المحتوى إن لم تتحقق الصلاحية — للأزرار والأقسام داخل الصفحات (عميل).
 */
export function PermissionGuard({ user, perm, anyOf, children }: Props) {
  const ok = perm
    ? hasPermission(user, perm)
    : anyOf?.length
      ? hasAnyPermission(user, anyOf)
      : false;
  if (!ok) return null;
  return <>{children}</>;
}

import "server-only";

import { redirect } from "next/navigation";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import type { AppUser } from "@/lib/types/db";

/** يمنع الوصول للشاشة بدون الصلاحية المطلوبة (يُعاد توجيهه للرئيسية). */
export async function requireScreen(permission: string): Promise<AppUser> {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    redirect("/login");
  }
  if (!hasPermission(appUser, permission)) {
    redirect("/dashboard");
  }
  return appUser;
}

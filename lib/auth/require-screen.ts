import "server-only";

import { redirect } from "next/navigation";

import { getDefaultLandingPath } from "@/lib/auth/default-landing";
import { canAccessReportsApp } from "@/lib/auth/report-permissions";
import { getSessionContext } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/auth/permissions";
import type { AppUser } from "@/lib/types/db";

/** يمنع الوصول للشاشة بدون الصلاحية المطلوبة (يُعاد توجيهه لأول شاشة مسموحة). */
export async function requireScreen(permission: string): Promise<AppUser> {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    redirect("/login");
  }
  if (!hasPermission(appUser, permission)) {
    redirect(getDefaultLandingPath(appUser));
  }
  return appUser;
}

/** يسمح بالوصول إن وُجدت أي صلاحية من القائمة (OR). */
export async function requireAnyScreen(permissions: string[]): Promise<AppUser> {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    redirect("/login");
  }
  if (!hasAnyPermission(appUser, permissions)) {
    redirect(getDefaultLandingPath(appUser));
  }
  return appUser;
}

/** صفحة التقارير — أي وصول لصفحة التقارير أو تبويب تقرير واحد على الأقل. */
export async function requireReportsAccess(): Promise<AppUser> {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    redirect("/login");
  }
  if (!canAccessReportsApp(appUser)) {
    redirect(getDefaultLandingPath(appUser));
  }
  return appUser;
}

import type { AppUser } from "@/lib/types/db";

import { PERM } from "@/lib/permissions/keys";

export function hasPermission(user: AppUser | null | undefined, permission: string): boolean {
  if (!user?.permissions?.length) return false;
  return user.permissions.includes(permission);
}

/** طلب تعديل على سجل حضور: من له صلاحية طلب التعديل أو الاعتماد (شاشة الاعتماد / المراجعة). */
export function canRequestAttendanceCorrection(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return hasPermission(user, PERM.CORRECTION_REQUEST) || hasPermission(user, PERM.APPROVAL);
}

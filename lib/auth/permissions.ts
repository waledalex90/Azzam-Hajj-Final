import type { AppUser } from "@/lib/types/db";

import { LEGACY_GRANTS, PERM } from "@/lib/permissions/keys";

/** مجموعة الصلاحيات الفعّالة: المخزَّنة + المشتقة من مفاتيح قديمة */
export function effectivePermissionSet(user: AppUser | null | undefined): Set<string> {
  const raw = user?.permissions ?? [];
  const set = new Set<string>();
  for (const p of raw) {
    const key = String(p).trim();
    if (!key) continue;
    set.add(key);
    const extra = LEGACY_GRANTS[key];
    if (extra) {
      for (const e of extra) set.add(e);
    }
  }
  return set;
}

/** مفتاح `*` في مصفوفة الدور = كل الصلاحيات (سوبر من جدول user_roles فقط). */
export function hasWildcardPermission(user: AppUser | null | undefined): boolean {
  return effectivePermissionSet(user).has(PERM.WILDCARD);
}

export function hasPermission(user: AppUser | null | undefined, permission: string): boolean {
  if (!user?.permissions?.length) return false;
  const eff = effectivePermissionSet(user);
  if (eff.has(PERM.WILDCARD)) return true;
  return eff.has(permission);
}

export function hasAnyPermission(user: AppUser | null | undefined, permissions: string[]): boolean {
  if (!permissions.length) return false;
  const eff = effectivePermissionSet(user);
  return permissions.some((p) => eff.has(p));
}

/** طلب تعديل على سجل حضور */
export function canRequestAttendanceCorrection(user: AppUser | null | undefined): boolean {
  if (!user) return false;
  return (
    hasPermission(user, PERM.REQUEST_ATTENDANCE_CORRECTION) || hasPermission(user, PERM.APPROVE_ATTENDANCE)
  );
}

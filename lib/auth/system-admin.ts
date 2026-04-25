import "server-only";

import { hasWildcardPermission } from "@/lib/auth/permissions";
import type { AppUser } from "@/lib/types/db";

/** مدير أعلى (سوبر): مفتاح `*` في صلاحيات الدور — لا يعتمد على اسم/slug الدور. */
export function isSystemAdminUser(user: AppUser | null | undefined): boolean {
  return user != null && hasWildcardPermission(user);
}

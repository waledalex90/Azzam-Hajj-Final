import "server-only";

import { ROLES } from "@/lib/constants/roles";
import type { AppUser } from "@/lib/types/db";

/** مدير النظام فقط — ليس Every HR. */
export function isSystemAdminUser(user: AppUser | null | undefined): boolean {
  return user != null && user.role === ROLES.admin;
}

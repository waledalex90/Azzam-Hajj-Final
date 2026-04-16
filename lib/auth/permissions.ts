import type { AppUser } from "@/lib/types/db";

export function hasPermission(user: AppUser | null | undefined, permission: string): boolean {
  if (!user?.permissions?.length) return false;
  return user.permissions.includes(permission);
}

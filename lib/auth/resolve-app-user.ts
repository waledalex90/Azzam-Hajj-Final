import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppUser } from "@/lib/types/db";
import { LEGACY_ROLE_LABELS } from "@/lib/constants/roles";
import { PERM } from "@/lib/permissions/keys";

/** إذا لم يُوجد صف في user_roles بعد (قبل تشغيل الـ migration). */
const LEGACY_PERMISSIONS: Record<string, string[]> = {
  admin: [
    PERM.PREP,
    PERM.APPROVAL,
    PERM.CORRECTION_REQUEST,
    PERM.WORKERS_IMPORT,
    PERM.USERS_MANAGE,
    PERM.ROLES_MANAGE,
  ],
  hr: [
    PERM.PREP,
    PERM.APPROVAL,
    PERM.CORRECTION_REQUEST,
    PERM.WORKERS_IMPORT,
    PERM.USERS_MANAGE,
  ],
  technical_observer: [PERM.PREP],
  field_observer: [PERM.PREP, PERM.APPROVAL, PERM.CORRECTION_REQUEST],
};

function parsePermissionsFromRow(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  return [];
}

type AppUserRow = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  username: string;
  role: string;
  allowed_site_ids?: number[] | null;
};

type UserRoleRow = {
  name_ar: string;
  permissions: unknown;
};

export function enrichAppUserWithRoleRow(base: AppUserRow, roleRow: UserRoleRow | null): AppUser {
  const permissions = roleRow
    ? parsePermissionsFromRow(roleRow.permissions)
    : (LEGACY_PERMISSIONS[base.role] ?? []);
  const roleLabel = (roleRow?.name_ar?.trim() || LEGACY_ROLE_LABELS[base.role] || base.role).trim();
  const allowedSiteIds = Array.isArray(base.allowed_site_ids) ? base.allowed_site_ids : [];
  const { allowed_site_ids: _as, ...rest } = base;
  return {
    ...rest,
    permissions,
    roleLabel,
    allowedSiteIds,
  };
}

/** تحميل مستخدم التطبيق مع صلاحيات الدور من جدول user_roles (أو التراجع الافتراضي). */
export async function loadAppUserWithRole(authUserId: string): Promise<AppUser | null> {
  const supabase = createSupabaseAdminClient();
  const { data: base } = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, username, role, allowed_site_ids")
    .eq("auth_user_id", authUserId)
    .maybeSingle<AppUserRow>();

  if (!base) return null;

  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("name_ar, permissions")
    .eq("slug", base.role)
    .maybeSingle<UserRoleRow>();

  // قبل تشغيل supabase_user_roles.sql أو عند عدم وجود الجدول: التراجع للصلاحيات الافتراضية.
  if (roleErr) {
    return enrichAppUserWithRoleRow(base, null);
  }

  return enrichAppUserWithRoleRow(base, roleRow);
}

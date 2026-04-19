import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAppUserRowForSession } from "@/lib/data/app-users-queries";
import type { AppUser } from "@/lib/types/db";
import { LEGACY_ROLE_LABELS } from "@/lib/constants/roles";
import { PERM } from "@/lib/permissions/keys";

/** شاشات عامة + تشغيل — تُستخدم عند عدم وجود صف في user_roles */
const SCREEN_PERMS: string[] = [
  PERM.DASHBOARD,
  PERM.WORKERS,
  PERM.SITES,
  PERM.CONTRACTORS,
  PERM.TRANSFERS,
  PERM.REPORTS,
  PERM.CORRECTIONS_SCREEN,
  PERM.VIOLATION_NOTICE,
  PERM.VIOLATIONS,
];

const OPS_PERMS: string[] = [
  PERM.PREP,
  PERM.APPROVAL,
  PERM.CORRECTION_REQUEST,
  PERM.WORKERS_IMPORT,
];

/** إذا لم يُوجد صف في user_roles بعد (قبل تشغيل الـ migration). */
const LEGACY_PERMISSIONS: Record<string, string[]> = {
  admin: [...SCREEN_PERMS, ...OPS_PERMS, PERM.USERS_MANAGE, PERM.ROLES_MANAGE],
  hr: [...SCREEN_PERMS, ...OPS_PERMS, PERM.USERS_MANAGE],
  technical_observer: [PERM.DASHBOARD, PERM.PREP, PERM.WORKERS, PERM.SITES, PERM.REPORTS],
  field_observer: [
    PERM.DASHBOARD,
    PERM.PREP,
    PERM.APPROVAL,
    PERM.CORRECTION_REQUEST,
    PERM.WORKERS,
    PERM.SITES,
    PERM.VIOLATIONS,
    PERM.VIOLATION_NOTICE,
    PERM.TRANSFERS,
  ],
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

  console.log("[loadAppUserWithRole] SQL step=app_users", {
    table: "app_users",
    filter: "auth_user_id = …",
    authUserId,
    client: "createSupabaseAdminClient (service role — bypasses RLS)",
  });

  const { data: base, error: baseErr } = await fetchAppUserRowForSession(supabase, authUserId);

  if (baseErr) {
    console.error("[loadAppUserWithRole] app_users FAILED", {
      message: baseErr.message,
      name: baseErr.name,
      stack: baseErr.stack,
    });
    return null;
  }

  console.log("[loadAppUserWithRole] app_users OK", { hasRow: Boolean(base), roleSlug: base?.role });

  if (!base) return null;

  console.log("[loadAppUserWithRole] SQL step=user_roles", {
    table: "user_roles",
    filter: `slug = ${JSON.stringify(base.role)}`,
  });

  const { data: roleRow, error: roleErr } = await supabase
    .from("user_roles")
    .select("name_ar, permissions")
    .eq("slug", base.role)
    .maybeSingle<UserRoleRow>();

  if (roleErr) {
    console.error("[loadAppUserWithRole] user_roles FAILED — using legacy permissions", {
      message: roleErr.message,
      code: (roleErr as { code?: string }).code,
      details: (roleErr as { details?: string }).details,
      hint: (roleErr as { hint?: string }).hint,
      roleSlug: base.role,
    });
    return enrichAppUserWithRoleRow(base, null);
  }

  console.log("[loadAppUserWithRole] user_roles OK", { hasRow: Boolean(roleRow) });

  return enrichAppUserWithRoleRow(base, roleRow);
}

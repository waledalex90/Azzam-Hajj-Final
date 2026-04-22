import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAppUserRowForSession } from "@/lib/data/app-users-queries";
import type { AppUser } from "@/lib/types/db";
import { LEGACY_ROLE_LABELS } from "@/lib/constants/roles";

/** مفاتيح قديمة (ما قبل التجزئة) — تُوسَّع فعلياً عبر LEGACY_GRANTS عند التحقق */
const SCREEN_PERMS: string[] = [
  "dashboard",
  "workers",
  "sites",
  "contractors",
  "transfers",
  "reports",
  "corrections_screen",
  "violation_notice",
  "violations",
];

const OPS_PERMS: string[] = ["prep", "approval", "correction_request", "workers_import"];

/** إذا لم يُوجد صف في user_roles بعد (قبل تشغيل الـ migration). */
const LEGACY_PERMISSIONS: Record<string, string[]> = {
  admin: [...SCREEN_PERMS, ...OPS_PERMS, "users_manage", "roles_manage"],
  hr: [...SCREEN_PERMS, ...OPS_PERMS, "users_manage"],
  /** اعتماد الحضور وطلب التعديل — للمراقب الفني وليس الميداني */
  technical_observer: [
    "dashboard",
    "prep",
    "approval",
    "correction_request",
    "corrections_screen",
    "workers",
    "sites",
    "reports",
  ],
  /** تحضير فقط في الميدان؛ بدون اعتماد ولا طلب تعديل */
  field_observer: ["prep", "workers", "sites", "violations", "violation_notice", "transfers"],
};

function parsePermissionsFromRow(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((x) => String(x));
  return [];
}

/** يدعم مصفوفة Postgres integer[] وأي تمثيل غير متوقع من PostgREST */
function normalizeAllowedSiteIds(raw: unknown): number[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) {
    return [...new Set(raw.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
  }
  if (typeof raw === "string") {
    const s = raw.trim();
    if (!s || s === "{}") return [];
    try {
      const p = JSON.parse(s) as unknown;
      if (Array.isArray(p)) {
        return [...new Set(p.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0))].sort((a, b) => a - b);
      }
    } catch {
      /* ignore */
    }
  }
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
  /** إن لم يُحمَّل العمود (استعلام قديم بدون allowed_site_ids) نُبقي undefined لاستخدام app_user_sites */
  const allowedSiteIds = Object.hasOwn(base, "allowed_site_ids")
    ? normalizeAllowedSiteIds(base.allowed_site_ids)
    : undefined;
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

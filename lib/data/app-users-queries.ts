import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

/** أعمدة اختيارية بعد تشغيل supabase_app_users_allowed_sites.sql */
const APP_USERS_FULL =
  "id, auth_user_id, full_name, username, role, login_email, allowed_site_ids" as const;
const APP_USERS_MINIMAL = "id, auth_user_id, full_name, username, role" as const;

const APP_USER_SESSION_FULL =
  "id, auth_user_id, full_name, username, role, allowed_site_ids" as const;
const APP_USER_SESSION_MINIMAL = "id, auth_user_id, full_name, username, role" as const;

function isMissingColumnError(err: { message?: string; code?: string; details?: string } | null): boolean {
  if (!err) return false;
  const m = `${err.message ?? ""} ${err.details ?? ""}`.toLowerCase();
  return (
    m.includes("column") ||
    m.includes("does not exist") ||
    err.code === "42703" ||
    err.code === "PGRST204"
  );
}

export type AppUserListRowRaw = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  username: string;
  role: string;
  login_email?: string | null;
  allowed_site_ids?: number[] | null;
};

/**
 * تحميل مستخدمي التطبيق للوحة الإدارة — يحاول الأعمدة الكاملة ثم يرجع للحد الأدنى إن لم تُنفَّذ الـ migration.
 */
export async function fetchAppUsersForManagement(supabase: SupabaseClient): Promise<{
  rows: AppUserListRowRaw[];
  error: { message: string; code?: string; details?: string } | null;
  usedFallbackColumns: boolean;
  attemptedDetail?: string;
}> {
  const full = await supabase.from("app_users").select(APP_USERS_FULL).order("id", { ascending: true });

  if (full.error && isMissingColumnError(full.error)) {
    console.error("[app_users] full select failed (will retry minimal):", full.error.message, full.error.code, full.error);
    const min = await supabase.from("app_users").select(APP_USERS_MINIMAL).order("id", { ascending: true });
    if (min.error) {
      console.error("[app_users] minimal select failed:", min.error.message, min.error);
      return {
        rows: [],
        error: { message: min.error.message, code: min.error.code, details: min.error.details },
        usedFallbackColumns: false,
        attemptedDetail: full.error.message,
      };
    }
    return {
      rows: (min.data ?? []) as AppUserListRowRaw[],
      error: null,
      usedFallbackColumns: true,
      attemptedDetail: full.error.message,
    };
  }

  if (full.error) {
    console.error("[app_users] select error:", full.error.message, full.error);
    return {
      rows: [],
      error: { message: full.error.message, code: full.error.code, details: full.error.details },
      usedFallbackColumns: false,
    };
  }

  return {
    rows: (full.data ?? []) as AppUserListRowRaw[],
    error: null,
    usedFallbackColumns: false,
  };
}

type SessionRow = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  username: string;
  role: string;
  allowed_site_ids?: number[] | null;
};

/**
 * صف واحد لجلسة المستخدم — بدون كسر التطبيق إذا عمود allowed_site_ids غير موجود.
 */
export async function fetchAppUserRowForSession(
  supabase: SupabaseClient,
  authUserId: string,
): Promise<{ data: SessionRow | null; error: Error | null }> {
  const full = await supabase
    .from("app_users")
    .select(APP_USER_SESSION_FULL)
    .eq("auth_user_id", authUserId)
    .maybeSingle<SessionRow>();

  if (full.error && isMissingColumnError(full.error)) {
    console.warn("[loadAppUserWithRole] retry without allowed_site_ids:", full.error.message);
    const min = await supabase
      .from("app_users")
      .select(APP_USER_SESSION_MINIMAL)
      .eq("auth_user_id", authUserId)
      .maybeSingle<SessionRow>();
    if (min.error) {
      console.error("[loadAppUserWithRole] minimal select failed:", min.error.message);
      return { data: null, error: new Error(min.error.message) };
    }
    return { data: min.data, error: null };
  }

  if (full.error) {
    console.error("[loadAppUserWithRole] select error:", full.error.message);
    return { data: null, error: new Error(full.error.message) };
  }

  return { data: full.data, error: null };
}

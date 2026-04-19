"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { PERM, PERMISSION_CATALOG } from "@/lib/permissions/keys";
import * as XLSX from "xlsx";

const LEGACY_SLUGS = new Set(["admin", "hr", "technical_observer", "field_observer"]);

function slugify(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "");
}

async function assertUsersManage() {
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.USERS_MANAGE)) {
    throw new Error("forbidden");
  }
}

async function assertRolesManage() {
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.ROLES_MANAGE)) {
    throw new Error("forbidden");
  }
}

async function allowedRoleSlugs(): Promise<Set<string>> {
  const supabase = createSupabaseAdminClient();
  const { data } = await supabase.from("user_roles").select("slug");
  if (data && data.length > 0) {
    return new Set(data.map((r) => r.slug as string));
  }
  return LEGACY_SLUGS;
}

export async function createAppUserAction(formData: FormData) {
  if (isDemoModeEnabled()) return { ok: true as const };
  try {
    await assertUsersManage();
  } catch {
    return { ok: false as const, error: "لا تملك صلاحية إدارة المستخدمين." };
  }

  const fullName = String(formData.get("fullName") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const loginEmail = String(formData.get("loginEmail") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");
  const role = String(formData.get("role") || "").trim();
  const siteRaw = String(formData.get("allowedSiteIds") || "").trim();
  const siteIds = siteRaw
    ? siteRaw
        .split(/[,\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];

  if (!fullName || !username || !loginEmail || !password || password.length < 6 || !role) {
    return { ok: false as const, error: "البيانات ناقصة أو كلمة المرور أقل من 6 أحرف." };
  }

  const allowed = await allowedRoleSlugs();
  if (!allowed.has(role)) {
    return { ok: false as const, error: "الدور غير صالح." };
  }

  const admin = createSupabaseAdminClient();
  const { data: authRes, error: authErr } = await admin.auth.admin.createUser({
    email: loginEmail,
    password,
    email_confirm: true,
  });
  if (authErr || !authRes.user) {
    return { ok: false as const, error: authErr?.message ?? "فشل إنشاء حساب الدخول." };
  }

  const ins = await admin.from("app_users").insert({
    auth_user_id: authRes.user.id,
    full_name: fullName,
    username,
    role,
    login_email: loginEmail,
    allowed_site_ids: siteIds,
  });

  if (ins.error) {
    await admin.auth.admin.deleteUser(authRes.user.id);
    return { ok: false as const, error: ins.error.message };
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function updateAppUserAction(formData: FormData) {
  if (isDemoModeEnabled()) return { ok: true as const };
  try {
    await assertUsersManage();
  } catch {
    return { ok: false as const, error: "لا تملك صلاحية إدارة المستخدمين." };
  }

  const id = Number(formData.get("userId"));
  const fullName = String(formData.get("fullName") || "").trim();
  const username = String(formData.get("username") || "").trim();
  const role = String(formData.get("role") || "").trim();
  const siteRaw = String(formData.get("allowedSiteIds") || "").trim();
  const siteIds = siteRaw
    ? siteRaw
        .split(/[,\s]+/)
        .map((s) => Number(s))
        .filter((n) => Number.isFinite(n) && n > 0)
    : [];

  if (!id || !fullName || !username || !role) {
    return { ok: false as const, error: "بيانات ناقصة." };
  }

  const allowed = await allowedRoleSlugs();
  if (!allowed.has(role)) {
    return { ok: false as const, error: "الدور غير صالح." };
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("app_users")
    .update({
      full_name: fullName,
      username,
      role,
      allowed_site_ids: siteIds,
    })
    .eq("id", id);

  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/users");
  return { ok: true as const };
}

export async function deleteAppUserAction(formData: FormData) {
  if (isDemoModeEnabled()) return { ok: true as const };
  try {
    await assertUsersManage();
  } catch {
    return { ok: false as const, error: "لا تملك صلاحية إدارة المستخدمين." };
  }

  const id = Number(formData.get("userId"));
  if (!id) return { ok: false as const, error: "معرف غير صالح." };

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("app_users").select("auth_user_id").eq("id", id).maybeSingle();
  const authId = row?.auth_user_id as string | undefined;

  const { error: delErr } = await admin.from("app_users").delete().eq("id", id);
  if (delErr) return { ok: false as const, error: delErr.message };

  if (authId) {
    await admin.auth.admin.deleteUser(authId);
  }

  revalidatePath("/users");
  return { ok: true as const };
}

export async function resetAppUserPasswordAction(formData: FormData) {
  if (isDemoModeEnabled()) return { ok: true as const };
  try {
    await assertUsersManage();
  } catch {
    return { ok: false as const, error: "لا تملك صلاحية إدارة المستخدمين." };
  }

  const id = Number(formData.get("userId"));
  const password = String(formData.get("newPassword") || "");
  if (!id || password.length < 6) {
    return { ok: false as const, error: "كلمة المرور يجب أن لا تقل عن 6 أحرف." };
  }

  const admin = createSupabaseAdminClient();
  const { data: row } = await admin.from("app_users").select("auth_user_id").eq("id", id).maybeSingle();
  const authId = row?.auth_user_id as string | undefined;
  if (!authId) {
    return { ok: false as const, error: "لا يوجد ربط بحساب الدخول لهذا المستخدم." };
  }

  const { error } = await admin.auth.admin.updateUserById(authId, { password });
  if (error) return { ok: false as const, error: error.message };
  revalidatePath("/users");
  return { ok: true as const };
}

export async function createRoleAction(formData: FormData) {
  if (isDemoModeEnabled()) return { ok: true as const };
  try {
    await assertRolesManage();
  } catch {
    return { ok: false as const, error: "لا تملك صلاحية إدارة الأدوار." };
  }

  const slugInput = String(formData.get("slug") || "").trim();
  const nameAr = String(formData.get("name_ar") || "").trim();
  const slug = slugify(slugInput || nameAr);
  if (!slug || !nameAr) {
    return { ok: false as const, error: "اسم الدور والمعرّف مطلوبان." };
  }

  const perms = PERMISSION_CATALOG.map((p) => p.key).filter((key) => formData.get(`perm_${key}`) === "on");

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("user_roles").insert({
    slug,
    name_ar: nameAr,
    permissions: perms,
  });
  if (error) {
    return { ok: false as const, error: error.message };
  }
  revalidatePath("/users");
  revalidatePath("/roles");
  return { ok: true as const };
}

/** استيراد من Excel: أعمدة — full_name, login_email, username, password, role, site_ids (اختياري، مفصولة بفواصل) */
export async function bulkImportUsersAction(formData: FormData) {
  if (isDemoModeEnabled()) return { ok: false as const, error: "وضع التجربة: الاستيراد معطّل." };
  try {
    await assertUsersManage();
  } catch {
    return { ok: false as const, error: "لا تملك صلاحية إدارة المستخدمين." };
  }

  const file = formData.get("file");
  if (!file || !(file instanceof File) || file.size < 10) {
    return { ok: false as const, error: "اختر ملف Excel صالحاً." };
  }

  const ab = await file.arrayBuffer();
  const wb = XLSX.read(new Uint8Array(ab), { type: "array" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  if (!rows.length) {
    return { ok: false as const, error: "الملف فارغ." };
  }

  const allowed = await allowedRoleSlugs();
  const admin = createSupabaseAdminClient();
  let ok = 0;
  let failed = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const fullName = String(r["full_name"] ?? r["الاسم"] ?? "").trim();
    const loginEmail = String(r["login_email"] ?? r["البريد"] ?? r["email"] ?? "").trim().toLowerCase();
    const username = String(r["username"] ?? r["اسم_الدخول"] ?? "").trim();
    const password = String(r["password"] ?? r["كلمة_السر"] ?? "");
    const role = String(r["role"] ?? r["الدور"] ?? "").trim();
    const sitesCell = String(r["site_ids"] ?? r["المواقع"] ?? "").trim();
    const siteIds = sitesCell
      ? sitesCell
          .split(/[,\s]+/)
          .map((s) => Number(s))
          .filter((n) => Number.isFinite(n) && n > 0)
      : [];

    if (!fullName || !loginEmail || !username || password.length < 6 || !role || !allowed.has(role)) {
      failed++;
      errors.push(`صف ${i + 2}: بيانات ناقصة أو دور غير صالح.`);
      continue;
    }

    const { data: authRes, error: authErr } = await admin.auth.admin.createUser({
      email: loginEmail,
      password,
      email_confirm: true,
    });
    if (authErr || !authRes.user) {
      failed++;
      errors.push(`صف ${i + 2}: ${authErr?.message ?? "auth"}`);
      continue;
    }

    const ins = await admin.from("app_users").insert({
      auth_user_id: authRes.user.id,
      full_name: fullName,
      username,
      role,
      login_email: loginEmail,
      allowed_site_ids: siteIds,
    });

    if (ins.error) {
      await admin.auth.admin.deleteUser(authRes.user.id);
      failed++;
      errors.push(`صف ${i + 2}: ${ins.error.message}`);
      continue;
    }
    ok++;
  }

  revalidatePath("/users");
  return {
    ok: true as const,
    imported: ok,
    failed,
    errors: errors.slice(0, 12),
  };
}

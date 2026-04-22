import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchAppUsersForManagement } from "@/lib/data/app-users-queries";
import { toClientJson } from "@/lib/utils/safe-client-json";

type Step = {
  step: string;
  ok: boolean;
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

/**
 * تشخيص إنتاجي: يعيد أخطاء Supabase/JSON كما هي (لا يخفيها Next مثل RSC).
 * يتطلب جلسة + صلاحية إدارة مستخدمين أو أدوار (نفس صفحة /users).
 */
export async function GET() {
  const steps: Step[] = [];

  const { appUser } = await getSessionContext();
  if (!appUser) {
    return NextResponse.json({ ok: false, error: "غير مسجّل", steps }, { status: 401 });
  }
  const allowed =
    hasPermission(appUser, PERM.MANAGE_USERS) || hasPermission(appUser, PERM.MANAGE_ROLES);
  if (!allowed) {
    return NextResponse.json({ ok: false, error: "لا صلاحية", steps }, { status: 403 });
  }

  try {
    const supabase = createSupabaseAdminClient();

    const userPayload = await fetchAppUsersForManagement(supabase);
    steps.push({
      step: "app_users (fetchAppUsersForManagement)",
      ok: !userPayload.error,
      message: userPayload.error?.message,
      code: userPayload.error?.code,
      details: userPayload.error?.details,
    });

    const { data: roleRows, error: rolesErr } = await supabase
      .from("user_roles")
      .select("slug, name_ar, permissions, created_at")
      .order("name_ar");
    steps.push({
      step: "user_roles (full select)",
      ok: !rolesErr,
      message: rolesErr?.message,
      code: rolesErr?.code,
      details: rolesErr?.details,
      hint: rolesErr?.hint,
    });

    const { data: siteRows, error: sitesErr } = await supabase.from("sites").select("id, name").order("name");
    steps.push({
      step: "sites",
      ok: !sitesErr,
      message: sitesErr?.message,
      code: sitesErr?.code,
      details: sitesErr?.details,
      hint: sitesErr?.hint,
    });

    const users = userPayload.rows.map((u) => ({
      id: u.id as number,
      auth_user_id: (u.auth_user_id as string | null) ?? null,
      full_name: u.full_name as string,
      username: u.username as string,
      role: u.role as string,
      login_email: u.login_email ?? null,
      allowed_site_ids: Array.isArray(u.allowed_site_ids) ? u.allowed_site_ids : [],
    }));

    const roles =
      roleRows?.map((r) => ({
        slug: r.slug as string,
        name_ar: r.name_ar as string,
        permissions: r.permissions,
      })) ?? [];

    const sites =
      siteRows?.map((s) => ({
        id: s.id as number,
        name: s.name as string,
      })) ?? [];

    const jsonSteps: [string, unknown][] = [
      ["JSON → عميل (users)", users],
      ["JSON → عميل (roles / permissions)", roles],
      ["JSON → عميل (sites)", sites],
      ["JSON → عميل (roleRows كاملة للوحة الأدوار)", roleRows ?? []],
    ];

    for (const [label, payload] of jsonSteps) {
      try {
        toClientJson(payload);
        steps.push({ step: label, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        steps.push({
          step: label,
          ok: false,
          message: msg,
          details:
            typeof payload === "object" && payload !== null
              ? `تلميح: افحص حقول jsonb غير متوقعة داخل permissions (مثلاً قيم لا تُحوَّل لـ JSON).`
              : undefined,
        });
      }
    }

    const ok = steps.every((s) => s.ok);
    return NextResponse.json({
      ok,
      note: "هذا المسار لا يخفي أخطاء قاعدة البيانات. إن ظهر خطأ هنا فهو سبب تعطّل صفحة المستخدمين غالباً.",
      usedFallbackColumns: userPayload.usedFallbackColumns,
      attemptedDetail: userPayload.attemptedDetail,
      steps,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : undefined;
    steps.push({ step: "استثناء غير متوقع", ok: false, message: msg, details: stack });
    return NextResponse.json({ ok: false, thrown: msg, stack, steps }, { status: 500 });
  }
}

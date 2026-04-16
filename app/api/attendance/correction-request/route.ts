import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";

const ALLOWED = ["admin", "hr", "technical_observer", "field_observer"];

export async function POST(request: Request) {
  if (isDemoModeEnabled()) {
    return NextResponse.json({ ok: true, demoMode: true });
  }

  const authClient = await createSupabaseServerClient();
  const {
    data: { user },
  } = await authClient.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdminClient();
  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, role")
    .eq("auth_user_id", user.id)
    .maybeSingle<{ id: number; role: string }>();

  if (!appUser || !ALLOWED.includes(appUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: { checkId?: number; reason?: string };
  try {
    body = (await request.json()) as { checkId?: number; reason?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const checkId = Number(body.checkId);
  const reason = String(body.reason ?? "طلب تعديل حضور من المراقب الميداني").trim() || "طلب تعديل حضور";

  if (!checkId) {
    return NextResponse.json({ error: "checkId required" }, { status: 400 });
  }

  const insertRes = await supabase.from("correction_requests").insert({
    attendance_id: checkId,
    requester_id: appUser.id,
    reason,
    status: "pending",
  });

  if (insertRes.error) {
    await supabase
      .from("attendance_checks")
      .update({ confirm_note: `طلب تعديل حضور: ${reason}` })
      .eq("id", checkId);
  }

  revalidatePath("/corrections");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-admin", "max");

  return NextResponse.json({ ok: true });
}

import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";

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
  const appUser = await loadAppUserWithRole(user.id);

  if (!appUser || !hasPermission(appUser, PERM.CORRECTION_REQUEST)) {
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

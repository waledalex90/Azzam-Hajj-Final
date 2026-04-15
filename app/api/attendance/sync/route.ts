import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { applyApprovalDecisionsEngine, submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";

type AttendanceStatus = "present" | "absent" | "half";

type SyncBody = {
  mode?: "attendance_submit" | "approval_decision";
  workDate?: string;
  status?: AttendanceStatus;
  workerIds?: number[];
  decision?: "confirm" | "reject";
  checkIds?: number[];
  idempotencyKey?: string;
};

export async function POST(request: Request) {
  const demoMode = isDemoModeEnabled();
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
    .maybeSingle<{ id: number; role: "admin" | "hr" | "technical_observer" | "field_observer" }>();

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const mode = body.mode ?? "attendance_submit";

  if (mode === "attendance_submit") {
    if (!appUser || !["admin", "hr", "technical_observer"].includes(appUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (
      !body?.workDate ||
      !body.status ||
      !["present", "absent", "half"].includes(body.status) ||
      !Array.isArray(body.workerIds)
    ) {
      return NextResponse.json({ error: "Invalid payload data" }, { status: 400 });
    }

    const workerIds = Array.from(new Set(body.workerIds.map((id) => Number(id)).filter(Boolean)));
    if (workerIds.length === 0) {
      return NextResponse.json({ ok: true, demoMode });
    }
    const status = body.status;
    const workDate = body.workDate;

    await submitAttendanceByWorkersEngine({
      items: workerIds.map((workerId) => ({ worker_id: workerId, status })),
      workDate,
      note: "direct attendance submit",
      idempotencyKey: body.idempotencyKey,
    });
  } else {
    if (!appUser || !["admin", "hr", "field_observer"].includes(appUser.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!body?.decision || !["confirm", "reject"].includes(body.decision) || !Array.isArray(body.checkIds)) {
      return NextResponse.json({ error: "Invalid payload data" }, { status: 400 });
    }

    const checkIds = Array.from(new Set(body.checkIds.map((id) => Number(id)).filter(Boolean)));
    if (checkIds.length === 0) {
      return NextResponse.json({ ok: true, demoMode });
    }

    await applyApprovalDecisionsEngine({
      checkIds,
      decision: body.decision,
      idempotencyKey: body.idempotencyKey,
    });
  }

  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return NextResponse.json({ ok: true, demoMode });
}

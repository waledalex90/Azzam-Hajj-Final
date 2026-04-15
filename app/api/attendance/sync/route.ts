import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type AttendanceStatus = "present" | "absent" | "half";

type SyncBody = {
  workDate: string;
  status: AttendanceStatus;
  workerIds: number[];
  idempotencyKey?: string;
};

export async function POST(request: Request) {
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

  if (!appUser || !["admin", "hr", "technical_observer"].includes(appUser.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!body?.workDate || !["present", "absent", "half"].includes(body.status) || !Array.isArray(body.workerIds)) {
    return NextResponse.json({ error: "Invalid payload data" }, { status: 400 });
  }

  const workerIds = Array.from(new Set(body.workerIds.map((id) => Number(id)).filter(Boolean)));
  if (workerIds.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await submitAttendanceByWorkersEngine({
    items: workerIds.map((workerId) => ({ worker_id: workerId, status: body.status })),
    workDate: body.workDate,
    note: "offline/online synced attendance",
    idempotencyKey: body.idempotencyKey,
  });

  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return NextResponse.json({ ok: true });
}

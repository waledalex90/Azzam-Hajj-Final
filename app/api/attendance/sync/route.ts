import { revalidatePath, revalidateTag } from "next/cache";
import { NextResponse } from "next/server";

import { assertWorkerIdsEligibleForPrep } from "@/lib/services/attendance-prep-guard";
import { applyApprovalDecisionsEngine, submitAttendanceByWorkersEngine } from "@/lib/services/attendance-engine";
import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isDemoModeEnabled } from "@/lib/demo-mode";
import { formatPostgrestLikeError } from "@/lib/utils/postgrest-error";

type AttendanceStatus = "present" | "absent" | "half";

export const maxDuration = 120;

type SyncBody = {
  mode?: "attendance_submit" | "approval_decision";
  workDate?: string;
  status?: AttendanceStatus;
  workerIds?: number[];
  /** 1 وردية صباحي، 2 مسائي — يُمرَّر لـ RPC */
  roundNo?: number;
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
    return NextResponse.json({ error: "Unauthorized", code: "401" }, { status: 401 });
  }

  const appUser = await loadAppUserWithRole(user.id);

  let body: SyncBody;
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    return NextResponse.json({ error: "Invalid payload", code: "400" }, { status: 400 });
  }

  const mode = body.mode ?? "attendance_submit";

  try {
    if (mode === "attendance_submit") {
      if (!appUser || !hasPermission(appUser, PERM.RECORD_ATTENDANCE_PREP)) {
        return NextResponse.json({ error: "Forbidden", code: "403" }, { status: 403 });
      }
      if (
        !body?.workDate ||
        !body.status ||
        !["present", "absent"].includes(body.status) ||
        !Array.isArray(body.workerIds)
      ) {
        return NextResponse.json({ error: "Invalid payload data", code: "400" }, { status: 400 });
      }

      const workerIds = Array.from(new Set(body.workerIds.map((id) => Number(id)).filter(Boolean)));
      if (workerIds.length === 0) {
        return NextResponse.json({ ok: true, demoMode });
      }
      const status = body.status;
      const workDate = body.workDate;
      const roundNo = Math.max(1, Math.min(Number(body.roundNo) || 1, 9));

      const prepGuard = await assertWorkerIdsEligibleForPrep(appUser, workerIds);
      if (!prepGuard.ok) {
        return NextResponse.json({ error: prepGuard.error, code: "400" }, { status: 400 });
      }

      await submitAttendanceByWorkersEngine({
        items: workerIds.map((workerId) => ({ worker_id: workerId, status })),
        workDate,
        note: "direct attendance submit",
        roundNo,
        idempotencyKey: body.idempotencyKey,
      });
    } else {
      if (!appUser || !hasPermission(appUser, PERM.APPROVE_ATTENDANCE)) {
        return NextResponse.json({ error: "Forbidden", code: "403" }, { status: 403 });
      }
      if (!body?.decision || !["confirm", "reject"].includes(body.decision) || !Array.isArray(body.checkIds)) {
        return NextResponse.json({ error: "Invalid payload data", code: "400" }, { status: 400 });
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
  } catch (e) {
    const msg = formatPostgrestLikeError(e);
    return NextResponse.json(
      { error: msg, code: "RPC_OR_ENGINE", detail: String(e) },
      { status: 500 },
    );
  }

  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return NextResponse.json({ ok: true, demoMode });
}

"use server";

import { revalidatePath, revalidateTag } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { normalizeShiftRound } from "@/lib/data/attendance";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

const ROUND_IN_CHUNK = 150;
const ID_IN_CHUNK = 400;

export type ResetAttendanceResult = { ok: true } | { ok: false; error: string };

export async function resetAttendanceChecksForDateRound(formData: FormData): Promise<ResetAttendanceResult> {
  if (isDemoModeEnabled()) return { ok: false, error: "demo" };
  const { appUser } = await getSessionContext();
  if (
    !appUser ||
    (!hasPermission(appUser, PERM.PREP) && !hasPermission(appUser, PERM.APPROVAL))
  ) {
    return { ok: false, error: "forbidden" };
  }

  const workDate = String(formData.get("workDate") ?? "").trim();
  const roundRaw = formData.get("roundNo");
  const siteRaw = formData.get("siteId");
  const roundNo = normalizeShiftRound(roundRaw === null || roundRaw === "" ? 1 : Number(roundRaw));
  const siteId =
    siteRaw !== null && siteRaw !== undefined && String(siteRaw) !== ""
      ? Number(siteRaw)
      : undefined;

  if (!/^\d{4}-\d{2}-\d{2}$/.test(workDate)) {
    return { ok: false, error: "bad_date" };
  }

  const supabase = createSupabaseAdminClient();
  let rQ = supabase.from("attendance_rounds").select("id").eq("work_date", workDate).eq("round_no", roundNo);
  if (siteId !== undefined && Number.isFinite(siteId)) {
    rQ = rQ.eq("site_id", siteId);
  }
  const { data: rounds, error: rErr } = await rQ;
  if (rErr) return { ok: false, error: rErr.message };

  const roundIds = ((rounds ?? []) as Array<{ id: number }>).map((r) => r.id).filter(Boolean);
  if (roundIds.length === 0) {
    revalidatePath("/attendance");
    revalidatePath("/approval");
    revalidatePath("/dashboard");
    revalidateTag("dashboard-stats", "max");
    revalidateTag("dashboard-admin", "max");
    return { ok: true };
  }

  const checkIds: number[] = [];
  for (let i = 0; i < roundIds.length; i += ROUND_IN_CHUNK) {
    const chunk = roundIds.slice(i, i + ROUND_IN_CHUNK);
    const { data: checks, error: cErr } = await supabase.from("attendance_checks").select("id").in("round_id", chunk);
    if (cErr) return { ok: false, error: cErr.message };
    for (const row of (checks ?? []) as Array<{ id: number }>) {
      if (row.id) checkIds.push(row.id);
    }
  }

  for (let i = 0; i < checkIds.length; i += ID_IN_CHUNK) {
    const chunk = checkIds.slice(i, i + ID_IN_CHUNK);
    const { error: crErr } = await supabase.from("correction_requests").delete().in("attendance_id", chunk);
    if (crErr) return { ok: false, error: crErr.message };
  }

  for (let i = 0; i < roundIds.length; i += ROUND_IN_CHUNK) {
    const chunk = roundIds.slice(i, i + ROUND_IN_CHUNK);
    const { error: delErr } = await supabase.from("attendance_checks").delete().in("round_id", chunk);
    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/attendance");
  revalidatePath("/approval");
  revalidatePath("/dashboard");
  revalidateTag("dashboard-stats", "max");
  revalidateTag("dashboard-admin", "max");
  return { ok: true };
}

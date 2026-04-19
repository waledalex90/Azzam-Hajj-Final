"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export async function approveWorkerViolationAction(formData: FormData): Promise<void> {
  if (isDemoModeEnabled()) {
    return;
  }
  const id = Number(formData.get("violationId"));
  const deductionRaw = String(formData.get("deduction_sar") ?? "").trim();
  const deduction = deductionRaw === "" ? NaN : Number(deductionRaw);
  if (!Number.isFinite(id) || id <= 0) {
    return;
  }
  if (!Number.isFinite(deduction) || deduction < 0) {
    return;
  }

  const { appUser } = await getSessionContext();
  if (!appUser) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("worker_violations")
    .update({
      status: "approved",
      deduction_sar: deduction,
    })
    .eq("id", id)
    .in("status", ["pending_review", "needs_more_info"]);

  if (error) {
    console.error(error);
    return;
  }

  revalidatePath("/violations");
  revalidatePath("/dashboard");
}

export async function rejectWorkerViolationAction(formData: FormData): Promise<void> {
  if (isDemoModeEnabled()) {
    return;
  }
  const id = Number(formData.get("violationId"));
  if (!Number.isFinite(id) || id <= 0) {
    return;
  }

  const { appUser } = await getSessionContext();
  if (!appUser) {
    return;
  }

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase
    .from("worker_violations")
    .update({ status: "rejected" })
    .eq("id", id)
    .in("status", ["pending_review", "needs_more_info"]);

  if (error) {
    console.error(error);
    return;
  }

  revalidatePath("/violations");
  revalidatePath("/dashboard");
}

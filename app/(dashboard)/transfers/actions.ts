"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  canCreateWorkerTransferRequest,
  canRespondAsDestinationSite,
  canRespondAsHr,
  getEffectiveSiteIdsForAppUser,
} from "@/lib/auth/transfer-access";
import { getSessionContext } from "@/lib/auth/session";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

function transfersUrl(tab: string, error?: string) {
  const p = new URLSearchParams();
  p.set("tab", tab);
  if (error) p.set("error", error);
  return `/transfers?${p.toString()}`;
}

export async function createWorkerTransferRequest(formData: FormData) {
  if (isDemoModeEnabled()) redirect(transfersUrl("new", "وضع العرض — لا يُحفظ."));

  const { appUser } = await getSessionContext();
  if (!appUser) redirect(transfersUrl("new", "يجب تسجيل الدخول."));

  const workerId = Number(formData.get("workerId"));
  const toSiteId = Number(formData.get("toSiteId"));
  if (!workerId || !toSiteId) redirect(transfersUrl("new", "بيانات ناقصة."));

  const siteIds = await getEffectiveSiteIdsForAppUser(appUser);
  const supabase = createSupabaseAdminClient();

  const { data: worker, error: wErr } = await supabase
    .from("workers")
    .select("id, current_site_id")
    .eq("id", workerId)
    .maybeSingle<{ id: number; current_site_id: number | null }>();

  if (wErr || !worker) redirect(transfersUrl("new", "العامل غير موجود."));
  const fromSiteId = worker.current_site_id;

  if (fromSiteId === toSiteId) redirect(transfersUrl("new", "الموقع الحالي مطابق لموقع الوجهة."));

  if (!canCreateWorkerTransferRequest(appUser, fromSiteId, siteIds)) {
    redirect(transfersUrl("new", "لا تملك صلاحية طلب نقل من هذا الموقع — ربط المواقع بحسابك في app_user_sites."));
  }

  const { error: insErr } = await supabase.from("worker_transfer_requests").insert({
    worker_id: workerId,
    from_site_id: fromSiteId,
    to_site_id: toSiteId,
    requested_by_app_user_id: appUser.id,
    status: "pending_destination",
  });

  if (insErr) {
    const msg =
      insErr.code === "23505"
        ? "يوجد طلب نشط لهذا العامل بالفعل."
        : insErr.message.includes("does not exist")
          ? "جدول الطلبات غير منشأ — نفّذ supabase_worker_transfer_requests.sql في Supabase."
          : "تعذّر إنشاء الطلب.";
    redirect(transfersUrl("new", msg));
  }

  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  redirect("/transfers?tab=new&ok=1");
}

export async function destinationApproveTransfer(formData: FormData) {
  if (isDemoModeEnabled()) redirect(transfersUrl("incoming", "وضع العرض."));
  const { appUser } = await getSessionContext();
  if (!appUser) redirect(transfersUrl("incoming", "يجب تسجيل الدخول."));

  const requestId = Number(formData.get("requestId"));
  if (!requestId) redirect(transfersUrl("incoming", "طلب غير صالح."));

  const siteIds = await getEffectiveSiteIdsForAppUser(appUser);
  const supabase = createSupabaseAdminClient();
  const { data: row, error } = await supabase
    .from("worker_transfer_requests")
    .select("id, to_site_id, status")
    .eq("id", requestId)
    .maybeSingle<{ id: number; to_site_id: number; status: string }>();

  if (error || !row || row.status !== "pending_destination") {
    redirect(transfersUrl("incoming", "الطلب غير متاح."));
  }

  if (!canRespondAsDestinationSite(appUser, row.to_site_id, siteIds)) {
    redirect(transfersUrl("incoming", "لا تملك صلاحية الموافقة كمراقب للموقع المستقبل."));
  }

  const { error: upErr } = await supabase
    .from("worker_transfer_requests")
    .update({
      status: "pending_hr",
      destination_responded_by_app_user_id: appUser.id,
      destination_responded_at: new Date().toISOString(),
      destination_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .eq("status", "pending_destination");

  if (upErr) redirect(transfersUrl("incoming", "تعذّر حفظ الموافقة."));

  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  redirect("/transfers?tab=hr");
}

export async function destinationRejectTransfer(formData: FormData) {
  if (isDemoModeEnabled()) redirect(transfersUrl("incoming", "وضع العرض."));
  const { appUser } = await getSessionContext();
  if (!appUser) redirect(transfersUrl("incoming", "يجب تسجيل الدخول."));

  const requestId = Number(formData.get("requestId"));
  const note = String(formData.get("note") || "").trim();
  if (!requestId) redirect(transfersUrl("incoming", "طلب غير صالح."));

  const siteIds = await getEffectiveSiteIdsForAppUser(appUser);
  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("worker_transfer_requests")
    .select("id, to_site_id, status")
    .eq("id", requestId)
    .maybeSingle<{ id: number; to_site_id: number; status: string }>();

  if (!row || row.status !== "pending_destination") redirect(transfersUrl("incoming", "الطلب غير متاح."));

  if (!canRespondAsDestinationSite(appUser, row.to_site_id, siteIds)) {
    redirect(transfersUrl("incoming", "لا تملك صلاحية الرفض لهذا الموقع."));
  }

  await supabase
    .from("worker_transfer_requests")
    .update({
      status: "rejected_destination",
      destination_responded_by_app_user_id: appUser.id,
      destination_responded_at: new Date().toISOString(),
      destination_note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  redirect("/transfers?tab=history");
}

export async function hrApproveTransfer(formData: FormData) {
  if (isDemoModeEnabled()) redirect(transfersUrl("hr", "وضع العرض."));
  const { appUser } = await getSessionContext();
  if (!appUser) redirect(transfersUrl("hr", "يجب تسجيل الدخول."));
  if (!canRespondAsHr(appUser)) redirect(transfersUrl("hr", "صلاحية HR/أدمن فقط."));

  const requestId = Number(formData.get("requestId"));
  if (!requestId) redirect(transfersUrl("hr", "طلب غير صالح."));

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("worker_transfer_requests")
    .select("id, worker_id, to_site_id, status")
    .eq("id", requestId)
    .maybeSingle<{ id: number; worker_id: number; to_site_id: number; status: string }>();

  if (!row || row.status !== "pending_hr") redirect(transfersUrl("hr", "الطلب غير في انتظار الموارد."));

  const { error: wErr } = await supabase
    .from("workers")
    .update({ current_site_id: row.to_site_id })
    .eq("id", row.worker_id);

  if (wErr) redirect(transfersUrl("hr", "تعذّر تحديث موقع العامل."));

  await supabase
    .from("worker_transfer_requests")
    .update({
      status: "approved",
      hr_responded_by_app_user_id: appUser.id,
      hr_responded_at: new Date().toISOString(),
      hr_note: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  revalidatePath("/transfers");
  revalidatePath("/workers");
  revalidatePath("/attendance");
  revalidatePath("/dashboard");
  redirect("/transfers?tab=history&ok=1");
}

export async function hrRejectTransfer(formData: FormData) {
  if (isDemoModeEnabled()) redirect(transfersUrl("hr", "وضع العرض."));
  const { appUser } = await getSessionContext();
  if (!appUser) redirect(transfersUrl("hr", "يجب تسجيل الدخول."));
  if (!canRespondAsHr(appUser)) redirect(transfersUrl("hr", "صلاحية HR/أدمن فقط."));

  const requestId = Number(formData.get("requestId"));
  const note = String(formData.get("note") || "").trim();
  if (!requestId) redirect(transfersUrl("hr", "طلب غير صالح."));

  const supabase = createSupabaseAdminClient();
  const { data: row } = await supabase
    .from("worker_transfer_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle<{ id: number; status: string }>();

  if (!row || row.status !== "pending_hr") redirect(transfersUrl("hr", "الطلب غير متاح."));

  await supabase
    .from("worker_transfer_requests")
    .update({
      status: "rejected_hr",
      hr_responded_by_app_user_id: appUser.id,
      hr_responded_at: new Date().toISOString(),
      hr_note: note || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  revalidatePath("/transfers");
  revalidatePath("/dashboard");
  redirect("/transfers?tab=history");
}

"use server";

import { revalidatePath } from "next/cache";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { getInfractionNoticeOptions, uploadContractorNoticeMediaFiles } from "@/lib/data/violations";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isDemoModeEnabled } from "@/lib/demo-mode";

export type SaveInfractionNoticeResult = { ok: true } | { ok: false; error: string };

export async function saveInfractionNoticeAction(formData: FormData): Promise<SaveInfractionNoticeResult> {
  if (isDemoModeEnabled()) {
    return { ok: true };
  }

  const workerId = Number(formData.get("workerId"));
  const contractorId = Number(formData.get("contractorId"));
  const selectedSite = String(formData.get("siteKey") || "");
  const noticeNo = String(formData.get("noticeNo") || "");
  const supervisorName = String(formData.get("supervisorName") || "").trim();
  const delegateName = String(formData.get("delegateName") || "").trim();
  const complexNo = String(formData.get("complexNo") || "").trim();
  const notes = String(formData.get("extraNotes") || "").trim();
  const date = String(formData.get("date") || "");
  const time = String(formData.get("time") || "");
  const violationTypeIds = formData
    .getAll("violationTypeIds")
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  const mediaRaw = formData.getAll("mediaFiles");
  const mediaFiles = mediaRaw.filter((f): f is File => typeof f === "object" && f !== null && "size" in f && f.size > 0);

  if (!workerId || !contractorId || violationTypeIds.length === 0) {
    return { ok: false, error: "بيانات ناقصة: العامل والمقاول وأنواع المخالفة مطلوبة." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: "التاريخ غير صالح." };
  }

  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.VIOLATION_NOTICE)) {
    return { ok: false, error: "لا تملك صلاحية إشعار المخالفة." };
  }

  const supabase = createSupabaseAdminClient();
  const options = await getInfractionNoticeOptions();
  const { data: contractor } = await supabase
    .from("contractors")
    .select("name")
    .eq("id", contractorId)
    .single<{ name: string }>();

  const siteIdFromKey =
    selectedSite === "mina"
      ? options.siteMapping.minaSiteId
      : selectedSite === "arafat"
        ? options.siteMapping.arafatSiteId
        : selectedSite === "muzdalifah"
          ? options.siteMapping.muzdalifahSiteId
          : null;

  if (!siteIdFromKey) {
    return { ok: false, error: "الموقع (المشعر) غير صالح." };
  }

  const occurredAt = new Date(`${date}T${time || "00:00"}:00`);
  const selectedTypes = options.violationTypes.filter((item) => violationTypeIds.includes(item.id));
  const typeNamesJoined = selectedTypes.map((item) => item.name_ar).join("، ");

  const summaryBase =
    `إشعار مخالفة رقم ${noticeNo}\n` +
    `الموقع: ${selectedSite}\n` +
    `رقم مجمع: ${complexNo || "-"}\n` +
    `المقاول: ${contractor?.name ?? "-"}\n` +
    `اسم مشرف المقاول: ${supervisorName || "-"}\n` +
    `المندوب: ${delegateName || "-"}\n` +
    `تفاصيل المخالفة: ${typeNamesJoined}\n` +
    `ملاحظات: ${notes || "-"}`;

  let mediaUrls: string[];
  try {
    mediaUrls = await uploadContractorNoticeMediaFiles(workerId, mediaFiles);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل رفع المرفقات";
    return { ok: false, error: msg };
  }

  const rowsToInsert = violationTypeIds.map((vid) => {
    const typeItem = options.violationTypes.find((t) => t.id === vid);
    const label = typeItem?.name_ar ?? `نوع #${vid}`;
    return {
      worker_id: workerId,
      site_id: siteIdFromKey,
      violation_type_id: vid,
      description: `${summaryBase}\n---\nسجل الخصم: «${label}» (قيمة الخصم من إعدادات النوع عند اعتماد المخالفة).`,
      occurred_at: occurredAt.toISOString(),
      reported_by: appUser.id,
      status: "pending_review" as const,
      attachment_urls: mediaUrls,
    };
  });

  if (rowsToInsert.length === 0) {
    return { ok: false, error: "لا صفوف للإدراج." };
  }

  const { error: insertError } = await supabase.from("worker_violations").insert(rowsToInsert);
  if (insertError) {
    console.error(insertError);
    return { ok: false, error: insertError.message };
  }

  revalidatePath("/violations");
  revalidatePath("/dashboard");
  revalidatePath("/violations/notice");

  return { ok: true };
}

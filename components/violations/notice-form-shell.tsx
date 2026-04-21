"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { saveInfractionNoticeAction } from "@/app/(dashboard)/violations/notice/actions";
import { Button } from "@/components/ui/button";
import { NOTICE_FORM_ID } from "@/components/violations/notice-print-toolbar";
import { compressImageFileForUpload } from "@/lib/utils/image-compress-client";

const NOTICE_SAVED_TOAST_KEY = "noticeSavedToast";

function clearFieldErrors(form: HTMLFormElement) {
  form.querySelectorAll(".np-field-error").forEach((el) => el.classList.remove("np-field-error"));
}

function markError(id: string | null) {
  if (!id) return;
  const el = document.getElementById(id);
  el?.classList.add("np-field-error");
  el?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function validateNoticeForm(form: HTMLFormElement): boolean {
  clearFieldErrors(form);

  const fd = new FormData(form);
  const workerId = String(fd.get("workerId") ?? "").trim();
  if (!workerId || !Number.isFinite(Number(workerId))) {
    toast.error("اختر العامل من القائمة", { duration: 5000 });
    markError("notice-field-worker");
    return false;
  }

  const contractorId = String(fd.get("contractorId") ?? "").trim();
  if (!contractorId || !Number.isFinite(Number(contractorId))) {
    toast.error("لم يُربط مقاول بالعامل — اختر عاملاً له مقاول في النظام", { duration: 6000 });
    markError("notice-field-contractor");
    return false;
  }

  const checked = form.querySelectorAll<HTMLInputElement>('input[name="violationTypeIds"]:checked');
  if (checked.length === 0) {
    toast.error("حدد نوع مخالفة واحد على الأقل", { duration: 5000 });
    markError("notice-field-violations");
    return false;
  }

  const dateEl = form.querySelector<HTMLInputElement>('input[name="date"]');
  const date = dateEl?.value?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    toast.error("حدد التاريخ", { duration: 5000 });
    markError("notice-field-date");
    return false;
  }

  return true;
}

async function buildFormDataWithCompressedImages(form: HTMLFormElement): Promise<FormData> {
  const raw = new FormData(form);
  const files = raw.getAll("mediaFiles").filter((f): f is File => f instanceof File && f.size > 0);
  raw.delete("mediaFiles");
  for (const f of files) {
    const out = f.type.startsWith("image/") ? await compressImageFileForUpload(f) : f;
    raw.append("mediaFiles", out);
  }
  return raw;
}

type Props = {
  children: ReactNode;
  showSavedBanner: boolean;
};

export function NoticeFormShell({ children, showSavedBanner }: Props) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const legacySavedToastRef = useRef(false);

  useEffect(() => {
    if (sessionStorage.getItem(NOTICE_SAVED_TOAST_KEY) === "1") {
      sessionStorage.removeItem(NOTICE_SAVED_TOAST_KEY);
      toast.success("تم حفظ إشعار المخالفة بنجاح", { duration: 4500, id: "notice-saved-reload" });
      return;
    }
    if (!showSavedBanner) return;
    if (legacySavedToastRef.current) return;
    legacySavedToastRef.current = true;
    toast.success("تم حفظ إشعار المخالفة بنجاح", { duration: 4500, id: "notice-saved-legacy" });
  }, [showSavedBanner]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!validateNoticeForm(form)) return;

    const btn = form.querySelector<HTMLButtonElement>(".notice-save-btn");
    setIsSubmitting(true);
    try {
      const fd = await buildFormDataWithCompressedImages(form);
      const res = await saveInfractionNoticeAction(fd);
      if (!res.ok) {
        toast.error(res.error, { duration: 8000 });
        setIsSubmitting(false);
        return;
      }
      btn?.classList.add("notice-save-flash");
      window.setTimeout(() => btn?.classList.remove("notice-save-flash"), 900);
      sessionStorage.setItem(NOTICE_SAVED_TOAST_KEY, "1");
      /* إعادة تحميل كاملة: نموذج نظيف بدون حالة React أو حقول عالقة */
      window.setTimeout(() => {
        window.location.assign("/violations/notice");
      }, 280);
    } catch (err) {
      console.error(err);
      toast.error("تعذّر إكمال الحفظ", { duration: 6000 });
      setIsSubmitting(false);
    }
  }

  return (
    <form
      id={NOTICE_FORM_ID}
      className="paper-form np-paper"
      encType="multipart/form-data"
      dir="rtl"
      onSubmit={onSubmit}
    >
      {children}
      <div className="no-print save-wrap space-y-2">
        {isSubmitting ? (
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-label="جاري الرفع"
          >
            <div className="notice-upload-progress-indeterminate h-full rounded-full bg-emerald-600" />
          </div>
        ) : null}
        <Button type="submit" pending={isSubmitting} className="notice-save-btn transition-[background-color] duration-200">
          حفظ إشعار المخالفة
        </Button>
      </div>
    </form>
  );
}

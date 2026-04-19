"use client";

import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import type { NoticePrintData } from "@/lib/types/notice-print";
import { buildNoticeInfractionPdf } from "@/lib/reports/notice-infraction-pdf";
import type { NoticeSiteKey } from "@/lib/data/violations";
import type { ViolationTypeOption } from "@/lib/types/db";

export const NOTICE_FORM_ID = "notice-contractor-print";

type ContractorMini = { id: number; name: string };
type WorkerMini = { id: number; name: string; id_number: string | null };

type Props = {
  violationTypes: ViolationTypeOption[];
  contractors: ContractorMini[];
  workers: WorkerMini[];
  viewPrintData: NoticePrintData | null;
};

function parseSiteKey(raw: string): NoticeSiteKey {
  const v = raw.trim();
  if (v === "mina" || v === "arafat" || v === "muzdalifah") return v;
  return "mina";
}

function buildFromForm(
  form: HTMLFormElement,
  contractors: ContractorMini[],
  workers: WorkerMini[],
): NoticePrintData | null {
  const fd = new FormData(form);
  const workerId = Number(fd.get("workerId"));
  const contractorId = Number(fd.get("contractorId"));
  const contractor = contractors.find((c) => c.id === contractorId);
  const worker = workers.find((w) => w.id === workerId);
  const violationTypeIds = fd
    .getAll("violationTypeIds")
    .map((v) => Number(v))
    .filter((n) => Number.isFinite(n) && n > 0);

  return {
    date: String(fd.get("date") ?? "").trim(),
    time: String(fd.get("time") ?? "").trim(),
    noticeNo: String(fd.get("noticeNo") ?? "").trim(),
    siteKey: parseSiteKey(String(fd.get("siteKey") ?? "")),
    complexNo: String(fd.get("complexNo") ?? "").trim(),
    contractorName: contractor?.name ?? "—",
    supervisorName: String(fd.get("supervisorName") ?? "").trim(),
    workerLabel: worker ? `${worker.name} — ${worker.id_number ?? ""}` : "—",
    delegateName: String(fd.get("delegateName") ?? "").trim(),
    extraNotes: String(fd.get("extraNotes") ?? "").trim(),
    violationTypeIds,
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** زر تحميل PDF — توليد برمجي (jsPDF) دون لقطة شاشة أو طباعة المتصفح */
export function NoticePrintToolbar({ violationTypes, contractors, workers, viewPrintData }: Props) {
  const [busy, setBusy] = useState(false);

  const getData = useCallback((): NoticePrintData | null => {
    if (viewPrintData) return viewPrintData;
    const form = document.getElementById(NOTICE_FORM_ID);
    if (!form || !(form instanceof HTMLFormElement)) {
      window.alert("لم يُعثر على نموذج الإشعار. تأكد أنك في وضع «إصدار إشعار جديد».");
      return null;
    }
    return buildFromForm(form, contractors, workers);
  }, [viewPrintData, contractors, workers]);

  const handlePdf = useCallback(async () => {
    const data = getData();
    if (!data) return;
    if (data.violationTypeIds.length === 0) {
      window.alert("اختر نوع مخالفة واحد على الأقل قبل التحميل.");
      return;
    }
    setBusy(true);
    try {
      const blob = await buildNoticeInfractionPdf(data, violationTypes);
      const safeNo = (data.noticeNo || "notice").replace(/[^\w\u0600-\u06FF-]/g, "_");
      downloadBlob(blob, `اشعار-مخالفة-${safeNo}.pdf`);
    } catch (e) {
      console.error(e);
      window.alert("تعذّر إنشاء ملف PDF. حاول مرة أخرى.");
    } finally {
      setBusy(false);
    }
  }, [getData, violationTypes]);

  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="primary" disabled={busy} onClick={handlePdf}>
        {busy ? "جاري التحميل…" : "تحميل PDF"}
      </Button>
    </div>
  );
}

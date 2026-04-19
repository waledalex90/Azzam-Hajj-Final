"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { createPortal, flushSync } from "react-dom";

import { Button } from "@/components/ui/button";
import type { NoticePrintData } from "@/components/violations/notice-print-document";
import { NoticePrintDocument } from "@/components/violations/notice-print-document";
import type { NoticeSiteKey } from "@/lib/data/violations";
import type { ViolationTypeOption } from "@/lib/types/db";

export const NOTICE_FORM_ID = "notice-contractor-print";

type ContractorMini = { id: number; name: string };
type WorkerMini = { id: number; name: string; id_number: string | null };

type Props = {
  violationTypes: ViolationTypeOption[];
  contractors: ContractorMini[];
  workers: WorkerMini[];
  /** عند عرض إشعار محفوظ — يُستخدم مباشرة للطباعة */
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

/** أزرار الطباعة + نموذج طباعة مخفي يظهر فقط داخل @media print */
export function NoticePrintToolbar({ violationTypes, contractors, workers, viewPrintData }: Props) {
  /** لنسخة «جديد»: آخر بيانات جُهّزت للطباعة من النموذج */
  const [draftPrint, setDraftPrint] = useState<NoticePrintData | null>(null);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- createPortal إلى document.body بعد مطابقة SSR
    setMounted(true);
  }, []);

  const sheetData = viewPrintData ?? draftPrint;

  const runPrint = useCallback(() => {
    let data: NoticePrintData | null = viewPrintData;
    if (!data) {
      const form = document.getElementById(NOTICE_FORM_ID);
      if (!form || !(form instanceof HTMLFormElement)) {
        window.alert("لم يُعثر على نموذج الإشعار. تأكد أنك في وضع «إصدار إشعار جديد».");
        return;
      }
      data = buildFromForm(form, contractors, workers);
    }
    if (!data) {
      window.alert("تعذّر تجهيز بيانات الطباعة.");
      return;
    }
    if (data.violationTypeIds.length === 0) {
      window.alert("اختر نوع مخالفة واحد على الأقل قبل الطباعة.");
      return;
    }
    if (!viewPrintData) {
      flushSync(() => setDraftPrint(data));
    }
    window.print();
  }, [viewPrintData, contractors, workers]);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="secondary" onClick={runPrint}>
          طباعة
        </Button>
        <Button
          type="button"
          variant="primary"
          onClick={runPrint}
          title="نفس نافذة الطباعة — اختر «Microsoft Print to PDF» أو «Save as PDF» لحفظ الملف"
        >
          حفظ PDF
        </Button>
      </div>

      {mounted &&
        sheetData &&
        createPortal(
          <div className="only-print notice-print-a4 notice-print-portal" aria-hidden>
            <NoticePrintDocument data={sheetData} violationTypes={violationTypes} />
          </div>,
          document.body,
        )}
    </>
  );
}

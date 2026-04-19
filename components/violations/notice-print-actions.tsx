"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { Button } from "@/components/ui/button";

/** يطابق id على نموذج إشعار المقاول في الصفحة */
export const NOTICE_PRINT_ROOT_ID = "notice-contractor-print";

async function captureToPdf(element: HTMLElement) {
  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();

  const pageCanvasHeightPx = Math.max(1, Math.floor((pdfH / pdfW) * canvas.width));
  let yPx = 0;
  let page = 0;

  while (yPx < canvas.height) {
    if (page > 0) pdf.addPage();
    const sliceH = Math.min(pageCanvasHeightPx, canvas.height - yPx);
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext("2d");
    if (!ctx) break;
    ctx.drawImage(canvas, 0, yPx, canvas.width, sliceH, 0, 0, canvas.width, sliceH);
    const data = slice.toDataURL("image/png", 1);
    const hMm = (sliceH / canvas.width) * pdfW;
    pdf.addImage(data, "PNG", 0, 0, pdfW, hMm);
    yPx += sliceH;
    page += 1;
  }

  const name = `اشعار-مخالفة-${new Date().toISOString().slice(0, 10)}.pdf`;
  pdf.save(name);
}

export function NoticePrintActions() {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="secondary" onClick={() => window.print()}>
        طباعة
      </Button>
      <Button
        type="button"
        variant="primary"
        onClick={async () => {
          const el = document.getElementById(NOTICE_PRINT_ROOT_ID);
          if (!el || !(el instanceof HTMLElement)) {
            window.alert("لم يُعثر على نموذج الإشعار للتصدير.");
            return;
          }
          try {
            await captureToPdf(el);
          } catch (e) {
            console.error(e);
            window.alert("تعذّر إنشاء ملف PDF. جرّب الطباعة واختر حفظ كـ PDF من المتصفح.");
          }
        }}
      >
        تحميل PDF
      </Button>
    </div>
  );
}

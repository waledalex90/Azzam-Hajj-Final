"use client";

import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

import { Button } from "@/components/ui/button";

export const NOTICE_PRINT_ROOT_ID = "notice-contractor-print";

async function captureToPdf(element: HTMLElement) {
  await document.fonts.ready.catch(() => {});
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

  element.scrollIntoView({ block: "start", behavior: "instant" as ScrollBehavior });

  const canvas = await html2canvas(element, {
    scale: 2.75,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: "#ffffff",
    imageTimeout: 20000,
    removeContainer: true,
    windowWidth: document.documentElement.offsetWidth,
    windowHeight: document.documentElement.offsetHeight,
    onclone: (clonedDoc, clonedEl) => {
      const root = clonedEl as HTMLElement;
      root.style.boxSizing = "border-box";
      root.style.backgroundColor = "#ffffff";
      root.style.color = "#111111";
      clonedDoc.documentElement.style.direction = "rtl";
      clonedDoc.body.style.direction = "rtl";
      clonedDoc.body.style.backgroundColor = "#ffffff";
      root.querySelectorAll(".violation-picker-float").forEach((n) => n.remove());
    },
  });

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
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
    const data = slice.toDataURL("image/jpeg", 0.92);
    const hMm = (sliceH / canvas.width) * pdfW;
    pdf.addImage(data, "JPEG", 0, 0, pdfW, hMm);
    yPx += sliceH;
    page += 1;
  }

  pdf.save(`اشعار-مخالفة-${new Date().toISOString().slice(0, 10)}.pdf`);
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
            window.alert("تعذّر إنشاء ملف PDF. استخدم «طباعة» ثم اختر حفظ كـ PDF من المتصفح.");
          }
        }}
      >
        تحميل PDF
      </Button>
    </div>
  );
}

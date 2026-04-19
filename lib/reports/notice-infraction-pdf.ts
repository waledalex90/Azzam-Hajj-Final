/**
 * توليد PDF إشعار مخالفة المقاول — رسم إحداثي (mm) بـ jsPDF،
 * خط Noto Naskh Arabic من public/fonts (كمسير الرواتب)، بدون DOM.
 */
import { jsPDF } from "jspdf";
import { ArabicShaper } from "arabic-persian-reshaper";

import type { NoticePrintData } from "@/lib/types/notice-print";
import type { ViolationTypeOption } from "@/lib/types/db";

const PAGE_W = 210;
const PAGE_H = 297;
const M = 10;
const INNER_W = PAGE_W - M * 2;
const FONT_FILE = "NotoNaskhArabic-Variable.ttf";
const FONT_FAMILY = "NotoNaskh";

const SITE_ORDER = ["mina", "arafat", "muzdalifah"] as const;
const SITE_LABEL: Record<(typeof SITE_ORDER)[number], string> = {
  mina: "منى",
  arafat: "عرفات",
  muzdalifah: "مزدلفة",
};

const LOGO_URL = "https://abn.sa.com/wp-content/uploads/2022/01/logo-removebg-preview.png";

function hasArabic(s: string) {
  return /[\u0600-\u06FF]/.test(s);
}

export function arPdfLine(s: string): string {
  if (!s) return "";
  const t = String(s);
  if (!hasArabic(t)) return t;
  const shaped = ArabicShaper.convertArabic(t);
  return shaped.split("").reverse().join("");
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function embedArabicFont(doc: jsPDF): Promise<boolean> {
  try {
    const res = await fetch(`/fonts/${FONT_FILE}`, { cache: "force-cache" });
    if (!res.ok) return false;
    const buf = await res.arrayBuffer();
    doc.addFileToVFS(FONT_FILE, arrayBufferToBase64(buf));
    doc.addFont(FONT_FILE, FONT_FAMILY, "normal");
    doc.setFont(FONT_FAMILY, "normal");
    return true;
  } catch {
    return false;
  }
}

async function loadLogoDataUrl(): Promise<string | null> {
  try {
    const res = await fetch(LOGO_URL, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    return new Promise((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(typeof r.result === "string" ? r.result : null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function drawRect(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.25);
  doc.rect(x, y, w, h);
}

function tr(
  doc: jsPDF,
  text: string,
  rightX: number,
  y: number,
  maxW: number,
  fontSize: number,
) {
  doc.setFontSize(fontSize);
  const raw = String(text);
  const t = hasArabic(raw) ? arPdfLine(raw) : raw;
  doc.text(t, rightX, y, { align: "right", maxWidth: maxW });
}

export async function buildNoticeInfractionPdf(
  data: NoticePrintData,
  violationTypes: ViolationTypeOption[],
): Promise<Blob> {
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait", compress: true });
  const fontOk = await embedArabicFont(doc);
  if (!fontOk) doc.setFont("helvetica", "normal");

  const selected = new Set(data.violationTypeIds);
  const right = PAGE_W - M;
  let y = M;

  const logoDataUrl = await loadLogoDataUrl();
  if (logoDataUrl) {
    try {
      doc.addImage(logoDataUrl, "PNG", M, y, 36, 11);
    } catch {
      try {
        doc.addImage(logoDataUrl, "JPEG", M, y, 36, 11);
      } catch {
        /* empty */
      }
    }
  }

  doc.setTextColor(0, 0, 0);
  tr(doc, "إشعار مخالفة", right, y + 5, INNER_W - 40, 15);
  tr(doc, "مشاريع دورات المياه موسم حج 1447هـ", right, y + 10, INNER_W - 40, 9);
  y += 15;

  doc.setLineWidth(0.35);
  doc.line(M, y, PAGE_W - M, y);
  y += 3;

  // صف ميتا: 4 أعمدة
  const colW = INNER_W / 4;
  const metaH = 11;
  for (let c = 0; c < 4; c++) {
    drawRect(doc, M + c * colW, y, colW, metaH);
  }
  const labs = ["التاريخ:", "الوقت:", "رقم الإشعار:", "رقم:"];
  const vals = [data.date || "—", data.time || "—", data.noticeNo || "—", data.noticeNo || "—"];
  for (let c = 0; c < 4; c++) {
    const rx = M + (c + 1) * colW - 1.5;
    tr(doc, labs[c], rx, y + 4, colW - 3, 7);
    tr(doc, vals[c], rx, y + 8.5, colW - 3, 8);
  }
  y += metaH + 2;

  // موقع + مجمع
  const sh = 13;
  drawRect(doc, M, y, INNER_W, sh);
  tr(doc, "الموقع (المشعر):", right - 2, y + 4, INNER_W - 4, 8);
  let cx = right - 10;
  for (let i = 0; i < SITE_ORDER.length; i++) {
    const key = SITE_ORDER[i];
    const on = data.siteKey === key;
    drawRect(doc, cx - 3.5, y + 5, 3.5, 3.5);
    if (on) {
      doc.setFontSize(8);
      doc.text("✓", cx - 1.9, y + 7.4);
      doc.setFont(fontOk ? FONT_FAMILY : "helvetica", "normal");
    }
    tr(doc, SITE_LABEL[key], cx - 5, y + 7.8, 22, 7);
    cx -= 28;
  }
  const cxTxt = data.complexNo.trim() || "—";
  tr(doc, `مجمع رقم: ${cxTxt}`, M + INNER_W * 0.4, y + 11.5, INNER_W * 0.55, 8);
  y += sh + 2;

  // مقاول | مشرف
  const ph = 12;
  const hw = INNER_W / 2;
  drawRect(doc, M, y, hw, ph);
  drawRect(doc, M + hw, y, hw, ph);
  tr(doc, "بيانات المقاول:", M + hw - 2, y + 4, hw - 3, 7);
  tr(doc, data.contractorName || "—", M + hw - 2, y + 9, hw - 3, 8);
  tr(doc, "اسم مشرف المقاول:", right - 2, y + 4, hw - 3, 7);
  tr(doc, data.supervisorName || "—", right - 2, y + 9, hw - 3, 8);
  y += ph + 2;

  const wh = 10;
  drawRect(doc, M, y, INNER_W, wh);
  tr(doc, "العامل:", right - 2, y + 3.5, INNER_W - 3, 7);
  tr(doc, data.workerLabel || "—", right - 2, y + 7.5, INNER_W - 3, 8);
  y += wh + 3;

  doc.setFont(fontOk ? FONT_FAMILY : "helvetica", "normal");
  doc.setFontSize(9);
  doc.text(arPdfLine("تفاصيل المخالفة"), PAGE_W / 2, y + 2, { align: "center" });
  y += 5;

  const lineH = 4.8;
  const v0 = y;
  for (let i = 0; i < violationTypes.length; i++) {
    const t = violationTypes[i];
    const on = selected.has(t.id);
    const rowY = v0 + i * lineH;
    if (rowY > PAGE_H - M - 62) break;
    drawRect(doc, right - 5.5, rowY, 3.2, 3.2);
    if (on) {
      doc.setFontSize(7.5);
      doc.text("✓", right - 3.9, rowY + 2.4);
      doc.setFont(fontOk ? FONT_FAMILY : "helvetica", "normal");
    }
    tr(doc, t.name_ar, right - 7, rowY + 2.4, INNER_W - 10, 7);
  }
  y = v0 + violationTypes.length * lineH + 2;

  doc.setDrawColor(100);
  doc.setLineWidth(0.12);
  doc.line(M + 2, y, right - 2, y);
  y += 2.5;
  doc.line(M + 2, y, right - 2, y);
  y += 4;
  doc.setDrawColor(0);

  if (data.extraNotes.trim()) {
    const shaped = arPdfLine(data.extraNotes.trim());
    const maxNoteH = 16;
    drawRect(doc, M, y, INNER_W, maxNoteH);
    tr(doc, "بيان إضافي:", right - 2, y + 3.5, INNER_W - 4, 7);
    doc.setFontSize(7);
    const lines = doc.splitTextToSize(shaped, INNER_W - 6);
    const slice = lines.slice(0, 4);
    let ny = y + 7;
    for (const ln of slice) {
      doc.text(ln, right - 2, ny, { align: "right", maxWidth: INNER_W - 6 });
      ny += 3.5;
    }
    y += maxNoteH + 2;
  }

  const legalTitle = "ملاحظات إضافية:";
  const legalBody = [
    "1- وفقاً لجدول الغرامات المرفق بالعقد سيتم توقيع الغرامات الواردة بالعقد.",
    "2- الإشعار من أصل يرسل للحسابات والصورة لمندوب المقاول ويوقع بالاستلام.",
    "3- في حال عدم حضور أو رفض مندوب المقاول التوقيع يتم إثبات الرفض على الإشعار.",
    "4- يتم إرسال صورة الإشعار على الجروب المخصص للأعمال.",
  ];
  const legH = 20;
  if (y + legH > PAGE_H - M - 26) {
    y = PAGE_H - M - 26 - legH;
  }
  drawRect(doc, M, y, INNER_W, legH);
  tr(doc, legalTitle, right - 2, y + 3.2, INNER_W - 4, 7);
  let ly = y + 6.5;
  doc.setFontSize(6);
  for (const line of legalBody) {
    tr(doc, line, right - 2, ly, INNER_W - 4, 6);
    ly += 3;
  }
  doc.setFont(fontOk ? FONT_FAMILY : "helvetica", "normal");
  y += legH + 2;

  const sigW = (INNER_W - 2) / 2;
  const sigH = 20;
  drawRect(doc, M, y, sigW, sigH);
  drawRect(doc, M + sigW + 2, y, sigW, sigH);

  const sup = data.supervisorName.trim();
  const del = data.delegateName.trim();

  tr(doc, "المشرف:", M + sigW - 2, y + 4, sigW - 3, 7);
  tr(
    doc,
    sup ? `الاسم: ${sup}` : "الاسم: ..............................................",
    M + sigW - 2,
    y + 9,
    sigW - 3,
    sup ? 7 : 6,
  );
  tr(doc, "التوقيع: ............................................", M + sigW - 2, y + 14, sigW - 3, 7);

  tr(doc, "المندوب:", right - 2, y + 4, sigW - 3, 7);
  tr(
    doc,
    del ? `الاسم: ${del}` : "الاسم: ..............................................",
    right - 2,
    y + 9,
    sigW - 3,
    del ? 7 : 6,
  );
  tr(doc, "التوقيع: ............................................", right - 2, y + 14, sigW - 3, 7);

  return doc.output("blob");
}

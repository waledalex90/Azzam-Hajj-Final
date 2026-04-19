import "server-only";

import fs from "node:fs";
import path from "node:path";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { ArabicShaper } from "arabic-persian-reshaper";

const FONT_VFS = "NotoNaskhArabic-Variable.ttf";
const FONT_FAMILY = "NotoNaskh";

const AR_MONTHS = [
  "يناير",
  "فبراير",
  "مارس",
  "أبريل",
  "مايو",
  "يونيو",
  "يوليو",
  "أغسطس",
  "سبتمبر",
  "أكتوبر",
  "نوفمبر",
  "ديسمبر",
];

const COLS: { key: string; ar: string; num?: boolean }[] = [
  { key: "worker_id", ar: "معرف" },
  { key: "worker_name", ar: "الاسم" },
  { key: "id_number", ar: "رقم الإقامة" },
  { key: "site_name", ar: "الموقع" },
  { key: "contractor_name", ar: "المقاول" },
  { key: "work_daily_rate_sar", ar: "يومية العمل", num: true },
  { key: "paid_day_equivalent", ar: "أيام الحضور", num: true },
  { key: "gross_sar", ar: "الاستحقاق", num: true },
  { key: "violation_deductions_sar", ar: "خصومات مخالفات", num: true },
  { key: "manual_deductions_sar", ar: "خصومات يدوية", num: true },
  { key: "net_sar", ar: "الصافي", num: true },
];

function hasArabic(s: string) {
  return /[\u0600-\u06FF]/.test(s);
}

/** خط عربي في سياق رسم PDF LTR: تشكيل ثم عكس ترتيب الحروف للعرض */
function arPdf(s: string): string {
  if (!s) return "";
  const t = String(s);
  if (!hasArabic(t)) return t;
  const shaped = ArabicShaper.convertArabic(t);
  return shaped.split("").reverse().join("");
}

function fmtNum(v: unknown): string {
  if (v === null || v === undefined || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);
  return n.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export async function buildPayrollPdfBuffer(opts: {
  rows: Record<string, unknown>[];
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
  includeSignature: boolean;
}): Promise<ArrayBuffer> {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  doc.setR2L(true);

  const fontPath = path.join(process.cwd(), "public", "fonts", FONT_VFS);
  let arabicFontOk = false;
  if (fs.existsSync(fontPath)) {
    try {
      const b64 = fs.readFileSync(fontPath).toString("base64");
      doc.addFileToVFS(FONT_VFS, b64);
      doc.addFont(FONT_VFS, FONT_FAMILY, "normal");
      doc.setFont(FONT_FAMILY, "normal");
      arabicFontOk = true;
    } catch {
      doc.setFont("helvetica", "normal");
    }
  } else {
    doc.setFont("helvetica", "normal");
  }

  const pageW = doc.internal.pageSize.getWidth();
  const margin = 10;
  let y = 12;

  doc.setFontSize(13);
  doc.setTextColor(15, 23, 42);
  doc.text(arPdf("مسير الرواتب — تقرير رسمي"), pageW / 2, y, { align: "center" });
  y += 6;
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  const mo = AR_MONTHS[Math.max(0, Math.min(11, opts.month - 1))];
  doc.text(
    arPdf(`الفترة: من ${opts.dateFrom} إلى ${opts.dateTo} — السنة ${opts.year} — الشهر ${mo} (${opts.month})`),
    pageW / 2,
    y,
    { align: "center" },
  );
  y += 6;

  const head = [COLS.map((c) => arPdf(c.ar))];
  const body = opts.rows.map((row) =>
    COLS.map((c) => {
      const raw = row[c.key];
      if (c.num) return fmtNum(raw);
      if (c.key === "worker_id") return raw === null || raw === undefined ? "" : String(raw);
      return arPdf(String(raw ?? ""));
    }),
  );

  const colStyles: Record<number, { halign?: "left" | "center" | "right" }> = {};
  COLS.forEach((c, i) => {
    colStyles[i] = { halign: c.num ? "right" : "right" };
  });

  autoTable(doc, {
    startY: y,
    head,
    body,
    styles: {
      font: arabicFontOk ? FONT_FAMILY : "helvetica",
      fontSize: 6,
      cellPadding: 1,
      lineColor: [148, 163, 184],
      lineWidth: 0.05,
    },
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: 255,
      fontStyle: "bold",
      font: arabicFontOk ? FONT_FAMILY : "helvetica",
    },
    alternateRowStyles: { fillColor: [241, 245, 249] },
    margin: { left: margin, right: margin },
    columnStyles: colStyles,
    tableLineColor: [148, 163, 184],
    tableLineWidth: 0.05,
  });

  const last = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable;
  let finalY = last?.finalY ?? y + 40;

  doc.setTextColor(100, 116, 139);
  doc.setFontSize(8);
  if (opts.includeSignature) {
    finalY += 6;
    doc.setFont(arabicFontOk ? FONT_FAMILY : "helvetica", "normal");
    doc.text(arPdf("مسؤول الموارد البشرية: ________________________________"), pageW - margin, finalY, {
      align: "right",
    });
    finalY += 5;
    doc.text(arPdf("المشرف المالي / التوقيع: ________________________________"), pageW - margin, finalY, {
      align: "right",
    });
    finalY += 6;
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(
      arPdf("تم إنشاء هذا الملف آلياً من نظام عزم — يُعتمد بعد المراجعة والتوقيع."),
      pageW / 2,
      finalY,
      { align: "center" },
    );
  } else {
    finalY += 8;
    doc.setFont(arabicFontOk ? FONT_FAMILY : "helvetica", "normal");
    doc.text(arPdf("تم الإنشاء آلياً من نظام عزم."), pageW / 2, finalY, { align: "center" });
  }

  return doc.output("arraybuffer") as ArrayBuffer;
}

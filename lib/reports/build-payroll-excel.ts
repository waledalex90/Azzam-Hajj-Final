import "server-only";

import ExcelJS from "exceljs";
import fs from "node:fs";
import path from "node:path";

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

const BORDER_THIN: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FF94A3B8" } },
  left: { style: "thin", color: { argb: "FF94A3B8" } },
  bottom: { style: "thin", color: { argb: "FF94A3B8" } },
  right: { style: "thin", color: { argb: "FF94A3B8" } },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E293B" },
};

const ALT_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF1F5F9" },
};

const WHITE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFFFFF" },
};

/** أعمدة المبالغ — تنسيق ريال */
const SAR_FMT = '#,##0.00 "ر.س."';
const DAYS_FMT = '#,##0.00';

type ColDef = {
  key: string;
  header: string;
  width: number;
  /** نص لمنع الترميز العلمي للأرقام الطويلة */
  forceText?: boolean;
  /** عمود مبلغ ريال */
  money?: boolean;
  /** أيام عمل (كسور) */
  days?: boolean;
};

const COLS: ColDef[] = [
  { key: "worker_id", header: "معرف الموظف", width: 12, forceText: true },
  { key: "worker_name", header: "الاسم", width: 26 },
  { key: "id_number", header: "رقم الإقامة", width: 18, forceText: true },
  { key: "site_name", header: "الموقع", width: 18 },
  { key: "contractor_name", header: "المقاول", width: 18 },
  { key: "work_daily_rate_sar", header: "يومية العمل", width: 14, money: true },
  { key: "paid_day_equivalent", header: "أيام الحضور", width: 12, days: true },
  { key: "gross_sar", header: "إجمالي الاستحقاق", width: 16, money: true },
  { key: "violation_deductions_sar", header: "خصومات المخالفات", width: 16, money: true },
  { key: "manual_deductions_sar", header: "الخصومات اليدوية", width: 16, money: true },
  { key: "net_sar", header: "الصافي", width: 14, money: true },
];

function numVal(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ملف Excel منسّق لمسير الرواتب (شعار اختياري من public/company-logo.png).
 */
export async function buildPayrollExcelBuffer(opts: {
  rows: Record<string, unknown>[];
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
  /** مساحة توقيع في آخر الملف — افتراضياً بدون */
  includeSignature?: boolean;
}): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.title = "مسير الرواتب";

  const sheet = workbook.addWorksheet("مسير الرواتب", {
    views: [{ rightToLeft: true, showGridLines: true }],
  });

  const lastCol = COLS.length;
  const colLetter = (n: number) => {
    let s = "";
    let x = n;
    while (x > 0) {
      const r = (x - 1) % 26;
      s = String.fromCodePoint(65 + r) + s;
      x = Math.floor((x - 1) / 26);
    }
    return s;
  };
  const L = colLetter(lastCol);

  let r = 1;

  const logoCandidates = [
    path.join(process.cwd(), "public", "company-logo.png"),
    path.join(process.cwd(), "public", "payroll-logo.png"),
  ];
  for (const logoPath of logoCandidates) {
    if (!fs.existsSync(logoPath)) continue;
    const ext = logoPath.toLowerCase().endsWith(".png") ? "png" : "jpeg";
    try {
      const buf = fs.readFileSync(logoPath);
      const imageId = workbook.addImage({
        buffer: buf as unknown as ExcelJS.Buffer,
        extension: ext,
      });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 160, height: 48 },
      });
      r = 4;
      break;
    } catch {
      /* skip */
    }
  }

  sheet.mergeCells(`A${r}:${L}${r}`);
  const title = sheet.getCell(`A${r}`);
  title.value = "مسير الرواتب — تقرير رسمي";
  title.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  r += 1;

  const periodLabel = `الفترة: من ${opts.dateFrom} إلى ${opts.dateTo} — السنة ${opts.year} — الشهر ${AR_MONTHS[Math.max(0, Math.min(11, opts.month - 1))]} (${opts.month})`;
  sheet.mergeCells(`A${r}:${L}${r}`);
  const pcell = sheet.getCell(`A${r}`);
  pcell.value = periodLabel;
  pcell.font = { size: 11, color: { argb: "FF334155" } };
  pcell.alignment = { horizontal: "center", vertical: "middle" };
  r += 2;

  const headerRowNum = r;
  COLS.forEach((c, i) => {
    const cell = sheet.getCell(headerRowNum, i + 1);
    cell.value = c.header;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = BORDER_THIN;
    sheet.getColumn(i + 1).width = c.width;
  });
  r += 1;

  opts.rows.forEach((row, idx) => {
    const fill = idx % 2 === 0 ? ALT_FILL : WHITE_FILL;
    COLS.forEach((c, j) => {
      const cell = sheet.getCell(r, j + 1);
      const raw = row[c.key];
      if (c.forceText) {
        cell.value = raw === null || raw === undefined ? "" : String(raw);
        cell.numFmt = "@";
      } else if (c.money) {
        const n = numVal(raw);
        cell.value = n !== null ? n : 0;
        cell.numFmt = SAR_FMT;
      } else if (c.days) {
        const n = numVal(raw);
        cell.value = n !== null ? n : 0;
        cell.numFmt = DAYS_FMT;
      } else {
        cell.value = raw === null || raw === undefined ? "" : String(raw);
      }
      cell.fill = fill;
      cell.alignment = {
        vertical: "middle",
        horizontal: c.money || c.days ? "right" : "right",
        wrapText: true,
      };
      cell.border = BORDER_THIN;
    });
    r += 1;
  });

  r += 2;
  if (opts.includeSignature) {
    sheet.mergeCells(`A${r}:E${r}`);
    const s1 = sheet.getCell(`A${r}`);
    s1.value = "مسؤول الموارد البشرية: ________________________________";
    s1.font = { size: 10 };
    s1.alignment = { horizontal: "right" };
    sheet.mergeCells(`F${r}:${L}${r}`);
    const s2 = sheet.getCell(`F${r}`);
    s2.value = "المشرف المالي / التوقيع: ________________________________";
    s2.font = { size: 10 };
    s2.alignment = { horizontal: "right" };
    r += 1;
    sheet.mergeCells(`A${r}:${L}${r}`);
    const foot = sheet.getCell(`A${r}`);
    foot.value = "تم إنشاء هذا الملف آلياً من نظام عزم — يُعتمد بعد المراجعة والتوقيع.";
    foot.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    foot.alignment = { horizontal: "center" };
  } else {
    sheet.mergeCells(`A${r}:${L}${r}`);
    const foot = sheet.getCell(`A${r}`);
    foot.value = "تم الإنشاء آلياً من نظام عزم — مسير الرواتب.";
    foot.font = { italic: true, size: 9, color: { argb: "FF64748B" } };
    foot.alignment = { horizontal: "center" };
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

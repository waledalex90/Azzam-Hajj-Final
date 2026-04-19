import "server-only";

import ExcelJS from "exceljs";
import fs from "node:fs";

import { findCompanyLogoFile } from "@/lib/reports/export-branding";

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

/** أرقام مالية بدون لاحقة نصية */
const MONEY_FMT = "#,##0.00";
const DAYS_FMT = "#,##0.00";

type ColDef = {
  key: string;
  header: string;
  width: number;
  forceText?: boolean;
  money?: boolean;
  days?: boolean;
  /** عمود توقيع يدوي */
  signatureCol?: boolean;
};

const BASE_COLS: ColDef[] = [
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

function buildCols(includeRowSignature: boolean): ColDef[] {
  if (!includeRowSignature) return BASE_COLS;
  const sig: ColDef = {
    key: "_sign",
    header: "التوقيع",
    width: 18,
    signatureCol: true,
  };
  const i = BASE_COLS.findIndex((c) => c.key === "worker_name");
  if (i < 0) return [...BASE_COLS, sig];
  return [...BASE_COLS.slice(0, i + 1), sig, ...BASE_COLS.slice(i + 1)];
}

function colLetter(n: number): string {
  let s = "";
  let x = n;
  while (x > 0) {
    const r = (x - 1) % 26;
    s = String.fromCodePoint(65 + r) + s;
    x = Math.floor((x - 1) / 26);
  }
  return s;
}

function numVal(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * ملف Excel لمسير الرواتب — شعار من public أو COMPANY_LOGO_ABS_PATH
 */
export async function buildPayrollExcelBuffer(opts: {
  rows: Record<string, unknown>[];
  dateFrom: string;
  dateTo: string;
  year: number;
  month: number;
  /** عمود توقيع فارغ بجانب الاسم */
  includeRowSignature?: boolean;
  /** توقيع إداري في نهاية الملف */
  includeFooterSignature?: boolean;
  /** @deprecated استخدم includeFooterSignature */
  includeSignature?: boolean;
}): Promise<Buffer> {
  const includeRowSignature = Boolean(opts.includeRowSignature);
  const includeFooterSignature =
    opts.includeFooterSignature ?? opts.includeSignature ?? false;

  const COLS = buildCols(includeRowSignature);
  const lastCol = COLS.length;
  const L = colLetter(lastCol);

  const workbook = new ExcelJS.Workbook();
  workbook.created = new Date();
  workbook.title = "مسير الرواتب";

  const sheet = workbook.addWorksheet("مسير الرواتب", {
    views: [{ rightToLeft: true, showGridLines: true }],
  });

  let r = 1;

  const logoFile = findCompanyLogoFile();
  if (logoFile) {
    try {
      const buf = fs.readFileSync(logoFile.absPath);
      const ext = logoFile.format === "PNG" ? "png" : "jpeg";
      const imageId = workbook.addImage({
        buffer: buf as unknown as ExcelJS.Buffer,
        extension: ext,
      });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 160, height: 48 },
      });
      r = 4;
    } catch {
      /* skip */
    }
  }

  const mo = AR_MONTHS[Math.max(0, Math.min(11, opts.month - 1))];
  const titleText = `مسير الرواتب — ${mo} ${opts.year}`;

  sheet.mergeCells(`A${r}:${L}${r}`);
  const title = sheet.getCell(`A${r}`);
  title.value = titleText;
  title.font = { bold: true, size: 16, color: { argb: "FF0F172A" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  r += 1;

  sheet.mergeCells(`A${r}:${L}${r}`);
  const periodCell = sheet.getCell(`A${r}`);
  periodCell.value = `فترة الاحتساب: من ${opts.dateFrom} إلى ${opts.dateTo}`;
  periodCell.font = { size: 11, color: { argb: "FF334155" }, bold: true };
  periodCell.alignment = { horizontal: "center", vertical: "middle" };
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
      if (c.signatureCol) {
        cell.value = "________________";
        cell.font = { size: 10, italic: true, color: { argb: "FF64748B" } };
      } else {
        const raw = row[c.key];
        if (c.forceText) {
          cell.value = raw === null || raw === undefined ? "" : String(raw);
          cell.numFmt = "@";
        } else if (c.money) {
          const n = numVal(raw);
          cell.value = n !== null ? n : 0;
          cell.numFmt = MONEY_FMT;
        } else if (c.days) {
          const n = numVal(raw);
          cell.value = n !== null ? n : 0;
          cell.numFmt = DAYS_FMT;
        } else {
          cell.value = raw === null || raw === undefined ? "" : String(raw);
        }
      }
      cell.fill = fill;
      cell.alignment = {
        vertical: "middle",
        horizontal: "right",
        wrapText: true,
      };
      cell.border = BORDER_THIN;
    });
    r += 1;
  });

  r += 2;
  if (includeFooterSignature) {
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

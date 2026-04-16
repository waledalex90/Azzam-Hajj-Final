/** CSV عربي: تهريب خلايا + BOM لـ Excel. */
export function escapeCsvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const CSV_BOM = "\uFEFF";

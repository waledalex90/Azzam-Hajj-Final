/** RFC4180-ish: escape for CSV cell */
export function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  if (/[\r\n",]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowToCsvLine(cells: unknown[]): string {
  return cells.map(csvEscape).join(",");
}

export const CSV_UTF8_BOM = "\ufeff";

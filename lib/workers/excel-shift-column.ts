/**
 * قراءة عمود الوردية من صف Excel (أسماء رؤوس متعددة، مسافات، أو عمود يحتوي «وردية» / shift).
 * يُستخدم في استيراد العمال فقط.
 */

function normalizeExcelHeader(key: string): string {
  return String(key ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim();
}

/** أول قيمة غير فارغة من عمود الوردية / shift في الصف */
export function getShiftColumnRaw(record: Record<string, unknown>): string {
  const directKeys = [
    "shift_round",
    "الوردية",
    "وردية",
    "shift",
    "Shift",
    "SHIFT",
    "الشفت",
  ];
  for (const d of directKeys) {
    if (Object.prototype.hasOwnProperty.call(record, d)) {
      const v = normalizeText(record[d]);
      if (v) return v;
    }
  }

  for (const [key, val] of Object.entries(record)) {
    const k = normalizeExcelHeader(key);
    const kl = k.toLowerCase();
    if (kl === "shift" || kl === "shift_round" || k === "الوردية" || k === "وردية") {
      const v = normalizeText(val);
      if (v) return v;
    }
    if (/وردية|ورديه|الشفت/i.test(k) || /^shift$/i.test(kl)) {
      const v = normalizeText(val);
      if (v) return v;
    }
  }
  return "";
}

/** صباحي → 1، مسائي → 2؛ فارغ → null */
export function parseShiftRoundValue(raw: string): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (t === "1" || /^1(\.0+)?$/.test(t)) return 1;
  if (t === "2" || /^2(\.0+)?$/.test(t)) return 2;
  const n = Number(String(t).replace(",", "."));
  if (Number.isFinite(n) && n === 1) return 1;
  if (Number.isFinite(n) && n === 2) return 2;

  if (/صباح|صبح|morning|^am$/i.test(t)) return 1;
  if (/مسائ|مساء|مسائي|evening|^pm$/i.test(t)) return 2;
  return null;
}

export function parseShiftRoundFromExcelRow(record: Record<string, unknown>): number | null {
  return parseShiftRoundValue(getShiftColumnRaw(record));
}

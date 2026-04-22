/** يطابق عمود role / enum app_role في PostgreSQL — يستبعد معرّفات خاطئة مثل "-" */
export const ROLE_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

export function isValidRoleSlug(slug: string): boolean {
  return ROLE_SLUG_PATTERN.test(slug.trim());
}

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u0640]/g;

/** حروف عربية → تقريب لاتيني للمعرّفات (بدون ضبط تشكيل كامل) */
const AR_TO_LAT: Record<string, string> = {
  ا: "a",
  أ: "a",
  إ: "i",
  آ: "aa",
  ٱ: "a",
  ب: "b",
  ت: "t",
  ث: "th",
  ج: "j",
  ح: "h",
  خ: "kh",
  د: "d",
  ذ: "dh",
  ر: "r",
  ز: "z",
  س: "s",
  ش: "sh",
  ص: "s",
  ض: "d",
  ط: "t",
  ظ: "z",
  ع: "a",
  غ: "gh",
  ف: "f",
  ق: "q",
  ك: "k",
  ل: "l",
  م: "m",
  ن: "n",
  ه: "h",
  و: "w",
  ي: "y",
  ى: "a",
  ئ: "y",
  ؤ: "w",
  ء: "a",
  ة: "h",
  "\uFEFB": "la",
  "\uFEFC": "la",
};

const EASTERN_DIGITS = "٠١٢٣٤٥٦٧٨٩";

function transliterateForSlug(s: string): string {
  let out = "";
  for (const ch of s) {
    const mapped = AR_TO_LAT[ch];
    if (mapped !== undefined) {
      out += mapped;
      continue;
    }
    const d = EASTERN_DIGITS.indexOf(ch);
    if (d >= 0) {
      out += String(d);
      continue;
    }
    if (/[a-zA-Z]/.test(ch)) {
      out += ch.toLowerCase();
      continue;
    }
    if (/[0-9]/.test(ch)) {
      out += ch;
      continue;
    }
    if (/\s/.test(ch)) {
      out += " ";
    }
  }
  return out;
}

/**
 * يحوّل اسم الدور (عربي/إنجليزي) إلى معرّف آمن يطابق ROLE_SLUG_PATTERN.
 * يُستخدم في الواجهة أثناء الكتابة وفي الخادم عند الحفظ.
 */
export function slugifyRoleLabel(raw: string): string {
  const cleaned = String(raw ?? "")
    .normalize("NFKC")
    .replace(ARABIC_DIACRITICS, "");
  const latin = transliterateForSlug(cleaned);
  let s = latin
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
  if (!s) {
    s = `role_${Date.now().toString(36).slice(-8)}`;
  }
  if (!/^[a-z]/.test(s)) {
    s = `r_${s}`;
  }
  return s;
}

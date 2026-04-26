/**
 * أنواع إشعار مخالفة المقاول — ترتيب العرض (أول المصفوفة = أول القائمة في النموذج).
 * يُستورد من الواجهة والطباعة بدون الاعتماد على lib/data/violations (لا Supabase).
 */
export const NOTICE_VIOLATION_CATALOG = [
  {
    code: "no_second_party_rep",
    name_ar: "عدم تواجد ممثل الطرف الثاني",
    severity: "high" as const,
  },
  { code: "worker_absence", name_ar: "غياب عامل / عاملية النظافة", severity: "high" as const },
  { code: "no_replacement", name_ar: "عدم توفير عامل بديل", severity: "high" as const },
  {
    code: "work_negligence",
    name_ar: "التقصير في الأعمال (عدم نظافة المجمع)",
    severity: "high" as const,
  },
  { code: "uniform_noncompliance", name_ar: "عدم الالتزام بالزي الرسمي", severity: "medium" as const },
  { code: "no_work_card", name_ar: "عدم حمل بطاقة العمل", severity: "medium" as const },
  { code: "public_etiquette", name_ar: "عدم الالتزام بالآداب العامة", severity: "medium" as const },
  { code: "bad_behavior", name_ar: "سوء السلوك مع الحجيج", severity: "high" as const },
  { code: "no_accommodation", name_ar: "عدم توفير إعاشة", severity: "high" as const },
  { code: "other_notice", name_ar: "أخرى", severity: "low" as const },
] as const;

const DISPLAY_ORDER_BY_CODE: Map<string, number> = new Map(
  NOTICE_VIOLATION_CATALOG.map((row, index) => [row.code, index]),
);
const DISPLAY_ORDER_BY_NAME_AR: Map<string, number> = new Map(
  NOTICE_VIOLATION_CATALOG.map((row, index) => [row.name_ar, index]),
);

function displayRank<T extends { id: number; name_ar: string; code?: string | null }>(t: T): number {
  const code = t.code?.trim() ?? "";
  if (code && DISPLAY_ORDER_BY_CODE.has(code)) return DISPLAY_ORDER_BY_CODE.get(code)!;
  const name = t.name_ar?.trim() ?? "";
  if (name && DISPLAY_ORDER_BY_NAME_AR.has(name)) return DISPLAY_ORDER_BY_NAME_AR.get(name)!;
  return 999;
}

/** فرز أنواع إشعار المخالفة حسب الترتيب الرسمي، بغض النظر عن ترتيب القاعدة أو الـ id. */
export function sortNoticeViolationTypesForDisplay<
  T extends { id: number; name_ar: string; code?: string | null },
>(types: T[]): T[] {
  return [...types].sort((a, b) => {
    const ai = displayRank(a);
    const bi = displayRank(b);
    if (ai !== bi) return ai - bi;
    return a.id - b.id;
  });
}

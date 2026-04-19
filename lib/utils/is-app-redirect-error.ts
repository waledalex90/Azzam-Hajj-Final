/** يطابق أخطاء redirect() من Next دون الاعتماد على تصديرات غير مستقرة من next/navigation */
export function isAppRedirectError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const digest = (error as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

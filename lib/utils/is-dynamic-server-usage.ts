/**
 * أخطاء تحكم داخلية في Next (cookies / searchParams أثناء محاولة التصيير الثابت).
 * يجب إعادة رميها ولا تُلتقط كأخطاء تطبيق.
 */
export function isDynamicServerUsage(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const dig = (error as Error & { digest?: string }).digest;
  return dig === "DYNAMIC_SERVER_USAGE" || error.message.includes("Dynamic server usage");
}

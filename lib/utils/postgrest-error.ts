/** تنسيق أخطاء PostgREST / Supabase للعرض في Toast (رسالة + كود + تفاصيل). */
export function formatPostgrestLikeError(e: unknown): string {
  if (e === null || e === undefined) return "خطأ غير معروف";
  if (typeof e === "string") return e;
  if (e instanceof Error) return e.message;
  const o = e as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.message === "string" && o.message) parts.push(o.message);
  if (typeof o.code === "string" && o.code) parts.push(`[${o.code}]`);
  if (typeof o.details === "string" && o.details) parts.push(String(o.details));
  if (typeof o.hint === "string" && o.hint) parts.push(`تلميح: ${o.hint}`);
  return parts.length > 0 ? parts.join(" — ") : JSON.stringify(e);
}

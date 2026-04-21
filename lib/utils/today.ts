/** منطقة زمنية موحّدة لأيام العمل في النظام (السعودية). */
const APP_TIME_ZONE = "Asia/Riyadh";

/**
 * تاريخ اليوم بتنسيق YYYY-MM-DD حسب تقويم التطبيق.
 * يُستخدم كقيمة افتراضية لفلاتر «يوم عمل» واحد.
 */
export function todayIsoDateInAppTimeZone(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function isIsoDateOnly(s: string | undefined): s is string {
  return Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
}

/** يوم عمل واحد من الرابط، أو اليوم الحالي إن كان غير صالح أو غير موجود. */
export function resolveWorkDateFromSearchParam(dateParam: string | undefined): string {
  const t = dateParam?.trim();
  if (isIsoDateOnly(t)) return t;
  return todayIsoDateInAppTimeZone();
}

/**
 * فلتر مخالفات: من — إلى. إن وُجد أحدهما فقط يُكمَّل بالقيمة نفسها؛
 * وإن غابا معاً يُفترض اليوم للطرفين (يوم واحد).
 */
export function resolveViolationListDateRange(
  dateFromParam: string | undefined,
  dateToParam: string | undefined,
): { dateFrom: string; dateTo: string } {
  const f = dateFromParam?.trim();
  const t = dateToParam?.trim();
  const vf = isIsoDateOnly(f) ? f : undefined;
  const vt = isIsoDateOnly(t) ? t : undefined;
  const day = todayIsoDateInAppTimeZone();
  if (!vf && !vt) return { dateFrom: day, dateTo: day };
  if (vf && !vt) return { dateFrom: vf, dateTo: vf };
  if (!vf && vt) return { dateFrom: vt, dateTo: vt };
  return { dateFrom: vf!, dateTo: vt! };
}

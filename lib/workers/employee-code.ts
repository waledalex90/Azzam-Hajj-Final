/** تطبيع كود الموظف — يطابق فهرس btrim في القاعدة */
export function normalizeEmployeeCode(value: unknown): string | null {
  const t = String(value ?? "").trim();
  if (!t) return null;
  return t.slice(0, 64);
}

/**
 * يحوّل القيمة إلى نسخة قابلة لـ JSON (كما يتوقعها Flight عند تمرير props لمكوّنات "use client").
 * إذا فشل (BigInt، مرجع دائري، إلخ) نرمي أثناء التنفيذ فيمكن التقاطه بـ try/catch في نفس الـ Server Component.
 */
export function toClientJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

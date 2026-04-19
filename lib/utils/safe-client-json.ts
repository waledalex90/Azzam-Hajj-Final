/**
 * يحوّل القيمة إلى نسخة قابلة لـ JSON (كما يتوقعها Flight عند تمرير props لمكوّنات "use client").
 * يحوّل BigInt إلى string لأن JSON.stringify يفشل عليها افتراضياً (يحدث أحياناً مع حقول Postgres).
 */
function jsonReplacer(_key: string, value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function toClientJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value, jsonReplacer)) as T;
}

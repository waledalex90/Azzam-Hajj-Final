/**
 * بريد Supabase Auth: إن وُجد @ يُعتبر بريداً كاملاً، وإلا يُفترض أن المدخل هو اسم دخول/كود فيُضاف النطاق.
 */
export function resolveLoginEmailForAuth(rawInput: string, domain: string): string {
  const s = rawInput.trim().toLowerCase();
  if (!s) return "";
  if (s.includes("@")) return s;
  const local = s.replace(/\s+/g, "");
  if (!local) return "";
  return `${local}@${domain}`;
}

/** مرشّحو الدخول: النطاق الظاهر ثم النطاقات الصامتة للحسابات القديمة. */
export function resolveLoginEmailCandidates(
  rawInput: string,
  primaryDomain: string,
  aliases: readonly string[] = [],
): string[] {
  const s = rawInput.trim().toLowerCase();
  if (!s) return [];
  if (s.includes("@")) return [s];
  const local = s.replace(/\s+/g, "");
  if (!local) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const domain of [primaryDomain, ...aliases]) {
    const d = String(domain || "").trim().toLowerCase();
    if (!d) continue;
    const email = `${local}@${d}`;
    if (seen.has(email)) continue;
    seen.add(email);
    out.push(email);
  }
  return out;
}

/**
 * إنشاء مستخدم: بريد صريح إن وُجد؛ وإلا يُبنى من اسم المستخدم + النطاق.
 * إن وُجد نص بدون @ في حقل البريد يُعامل كجزء محلي فقط.
 */
export function resolveStoredLoginEmail(username: string, explicitEmail: string, domain: string): string {
  const ex = explicitEmail.trim().toLowerCase();
  if (ex.includes("@")) return ex;
  if (ex.length > 0) {
    const local = ex.replace(/\s+/g, "");
    return `${local}@${domain}`;
  }
  const u = username.trim().toLowerCase().replace(/\s+/g, "");
  return `${u}@${domain}`;
}

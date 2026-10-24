const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase configuration is incomplete.");
}

if (process.env.VERCEL && process.env.NODE_ENV === "production" && !supabaseServiceRoleKey) {
  throw new Error("Server configuration is incomplete.");
}

function parseDomainList(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * نطاق البريد الاصطناعي لاسم الدخول.
 * الافتراضي عام ولا يظهر اسم جهة عمل.
 * التوافق مع الحسابات الحالية: NEXT_PUBLIC_AUTH_EMAIL_DOMAIN أو aliases صامتة.
 */
const primaryDomain =
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN ?? process.env.AUTH_EMAIL_DOMAIN ?? "workforcehub.local";

const aliasDomains = parseDomainList(
  process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN_ALIASES ?? process.env.AUTH_EMAIL_DOMAIN_ALIASES,
);

/** توافق صامت مع هويات الدخول الحالية دون إظهار اسم الجهة في الواجهة. */
if (primaryDomain.toLowerCase() !== "azzam.com" && !aliasDomains.includes("azzam.com")) {
  aliasDomains.push("azzam.com");
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey: supabaseServiceRoleKey ?? supabaseAnonKey,
  authEmailDomain: primaryDomain,
  /** نطاقات دخول صامتة للحسابات القديمة — لا تُعرض في الواجهة. */
  authEmailDomainAliases: aliasDomains.filter((d) => d !== primaryDomain.toLowerCase()),
};

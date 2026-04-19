const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase env vars are missing: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.");
}

if (process.env.VERCEL && process.env.NODE_ENV === "production" && !supabaseServiceRoleKey) {
  throw new Error("SUPABASE_SERVICE_ROLE_KEY is required on Vercel (Azzam Hajj Supabase project).");
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  /** في التطوير فقط: إن لم يُضبط service role يُستخدم anon (قد يقيّد بعض العمليات). */
  supabaseServiceRoleKey: supabaseServiceRoleKey ?? supabaseAnonKey,
  /**
   * نطاق البريد الاصطناعي لاسم الدخول (username@domain). يُعرَّف للعميل عبر NEXT_PUBLIC_AUTH_EMAIL_DOMAIN.
   */
  authEmailDomain: process.env.NEXT_PUBLIC_AUTH_EMAIL_DOMAIN ?? process.env.AUTH_EMAIL_DOMAIN ?? "azzam.com",
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Supabase env vars are missing.");
}

export const env = {
  supabaseUrl,
  supabaseAnonKey,
  supabaseServiceRoleKey: supabaseServiceRoleKey ?? supabaseAnonKey,
};

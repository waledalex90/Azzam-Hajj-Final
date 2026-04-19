import { createClient } from "@supabase/supabase-js";

import { env } from "@/lib/env";

/**
 * عميل بمفتاح **Service Role**: يتجاوز سياسات RLS على جداول Supabase.
 * للمقارنة: `createSupabaseServerClient` يستخدم **Anon key** مع جلسة المستخدم — أي استعلام مباشر للجداول يخضع لـ RLS.
 */
export function createSupabaseAdminClient() {
  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

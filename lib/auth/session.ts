import { cache } from "react";

import type { AppUser } from "@/lib/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getSessionContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authUser: null, appUser: null };
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("id, auth_user_id, full_name, username, role")
    .eq("auth_user_id", user.id)
    .single<AppUser>();

  return { authUser: user, appUser: appUser ?? null };
});

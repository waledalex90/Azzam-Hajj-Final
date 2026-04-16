import { cache } from "react";

import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const getSessionContext = cache(async () => {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { authUser: null, appUser: null };
  }

  const appUser = await loadAppUserWithRole(user.id);
  return { authUser: user, appUser };
});

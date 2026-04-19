import { cache } from "react";

import type { User } from "@supabase/supabase-js";

import { loadAppUserWithRole } from "@/lib/auth/resolve-app-user";
import type { AppUser } from "@/lib/types/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SessionContext = {
  authUser: User | null;
  appUser: AppUser | null;
  /** يُملأ عند فشل تحميل app_users/user_roles أو خطأ فادح — للعرض بدل Error Boundary العام */
  sessionError?: string;
};

export const getSessionContext = cache(async (): Promise<SessionContext> => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr) {
      console.error("[getSessionContext] auth.getUser:", authErr.message, authErr);
      return { authUser: null, appUser: null, sessionError: `auth.getUser: ${authErr.message}` };
    }

    if (!user) {
      return { authUser: null, appUser: null };
    }

    try {
      const appUser = await loadAppUserWithRole(user.id);
      return { authUser: user, appUser };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stack = e instanceof Error ? e.stack : "";
      console.error("[getSessionContext] loadAppUserWithRole threw:", msg, stack, e);
      return {
        authUser: user,
        appUser: null,
        sessionError: `${msg}${stack ? `\n${stack}` : ""}`,
      };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    const stack = e instanceof Error ? e.stack : "";
    console.error("[getSessionContext] fatal:", e);
    return { authUser: null, appUser: null, sessionError: `${msg}${stack ? `\n${stack}` : ""}` };
  }
});

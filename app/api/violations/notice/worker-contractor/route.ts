import { NextResponse } from "next/server";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

/**
 * استعلام خفيف: المقاول والموقع الحالي للعامل — بعد اختيار العامل في إشعار المخالفة.
 */
export async function GET(req: Request) {
  const { appUser } = await getSessionContext();
  if (!appUser || !hasPermission(appUser, PERM.CREATE_VIOLATION_NOTICE)) {
    return NextResponse.json({ error: "غير مصرّح" }, { status: 403 });
  }

  const url = new URL(req.url);
  const workerId = Number(url.searchParams.get("workerId"));
  if (!Number.isFinite(workerId) || workerId <= 0) {
    return NextResponse.json({ error: "workerId غير صالح" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: row, error } = await admin
    .from("workers")
    .select("id, contractor_id, current_site_id")
    .eq("id", workerId)
    .eq("is_deleted", false)
    .maybeSingle<{
      id: number;
      contractor_id: number | null;
      current_site_id: number | null;
    }>();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "العامل غير موجود" }, { status: 404 });
  }

  const cid = row.contractor_id;
  let contractorName: string | null = null;
  if (cid != null && Number.isFinite(cid) && cid > 0) {
    const { data: c } = await admin.from("contractors").select("name").eq("id", cid).maybeSingle<{ name: string }>();
    contractorName = c?.name ?? null;
  }

  return NextResponse.json({
    contractorId: cid,
    contractorName,
    currentSiteId: row.current_site_id,
  });
}

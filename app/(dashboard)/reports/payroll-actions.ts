"use server";

import { canViewReportTab } from "@/lib/auth/report-permissions";
import { getSessionContext } from "@/lib/auth/session";
import { hasPermission, hasWildcardPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import type { AppUser } from "@/lib/types/db";
import {
  approvePayrollPeriodRpc,
  isPayrollScopeLockedRpc,
  type ReportFilters,
  unlockPayrollPeriodRpc,
  upsertPayrollManualDeduction,
} from "@/lib/reports/queries";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function canManagePayrollLock(user: AppUser | null | undefined) {
  if (!user) return false;
  return (
    hasWildcardPermission(user) ||
    hasPermission(user, PERM.APPROVE_ATTENDANCE) ||
    hasPermission(user, PERM.MANAGE_USERS)
  );
}

export async function getPayrollLockStateAction(f: ReportFilters): Promise<boolean> {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canViewReportTab(appUser, "payroll")) throw new Error("غير مصرح");
  return isPayrollScopeLockedRpc(f);
}

export async function savePayrollManualDeductionAction(payload: {
  workerId: number;
  periodStart: string;
  periodEnd: string;
  amountSar: number;
  filter: Pick<ReportFilters, "siteIds" | "contractorIds" | "supervisorIds">;
}) {
  const { appUser } = await getSessionContext();
  if (!appUser) {
    throw new Error("غير مصرح");
  }
  if (!canViewReportTab(appUser, "payroll")) throw new Error("غير مصرح");
  if (!payload.periodStart || !payload.periodEnd) {
    throw new Error("فترة غير صالحة");
  }
  await upsertPayrollManualDeduction(
    payload.workerId,
    payload.periodStart,
    payload.periodEnd,
    payload.amountSar,
    payload.filter,
  );
}

export async function approvePayrollPeriodAction(f: ReportFilters) {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canViewReportTab(appUser, "payroll")) throw new Error("غير مصرح");
  if (!canManagePayrollLock(appUser)) {
    throw new Error("ليس لديك صلاحية اعتماد المسير.");
  }
  await approvePayrollPeriodRpc(f, appUser.id);
}

export async function unlockPayrollPeriodAction(f: ReportFilters) {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canViewReportTab(appUser, "payroll")) throw new Error("غير مصرح");
  if (!canManagePayrollLock(appUser)) {
    throw new Error("ليس لديك صلاحية إلغاء قفل المسير.");
  }
  await unlockPayrollPeriodRpc(f);
}

type ImportPayrollRow = { workerId: number; amountSar: number; idNumber?: string };

export async function importPayrollDeductionsAction(payload: {
  rows: ImportPayrollRow[];
  periodStart: string;
  periodEnd: string;
  filter: Pick<ReportFilters, "siteIds" | "contractorIds" | "supervisorIds">;
}) {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canViewReportTab(appUser, "payroll")) throw new Error("غير مصرح");
  if (!payload.periodStart || !payload.periodEnd) throw new Error("فترة غير صالحة");

  const needId = payload.rows.filter((r) => r.idNumber && (!r.workerId || r.workerId <= 0));
  const idNumbers = Array.from(
    new Set(needId.map((r) => String(r.idNumber).trim().replace(/\s+/g, "")).filter(Boolean)),
  );
  const idToWorker = new Map<string, number>();
  if (idNumbers.length > 0) {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
      .from("workers")
      .select("id, id_number")
      .in(
        "id_number",
        idNumbers as string[],
      );
    if (error) throw new Error(error.message);
    for (const w of (data ?? []) as Array<{ id: number; id_number: string }>) {
      const k = String(w.id_number).trim().replace(/\s+/g, "");
      if (k) idToWorker.set(k, w.id);
    }
  }

  let ok = 0;
  for (const r of payload.rows) {
    let wid = r.workerId;
    if ((!Number.isFinite(wid) || wid <= 0) && r.idNumber) {
      const k = String(r.idNumber).trim().replace(/\s+/g, "");
      wid = idToWorker.get(k) ?? 0;
    }
    if (!Number.isFinite(wid) || wid <= 0) continue;
    await upsertPayrollManualDeduction(
      wid,
      payload.periodStart,
      payload.periodEnd,
      r.amountSar,
      payload.filter,
    );
    ok += 1;
  }
  return { imported: ok };
}

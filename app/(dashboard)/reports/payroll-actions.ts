"use server";

import { getSessionContext } from "@/lib/auth/session";
import { hasPermission } from "@/lib/auth/permissions";
import { PERM } from "@/lib/permissions/keys";
import type { AppUser } from "@/lib/types/db";
import {
  approvePayrollPeriodRpc,
  isPayrollScopeLockedRpc,
  type ReportFilters,
  unlockPayrollPeriodRpc,
  upsertPayrollManualDeduction,
} from "@/lib/reports/queries";

function canManagePayrollLock(user: AppUser | null | undefined) {
  if (!user) return false;
  return hasPermission(user, PERM.APPROVE_ATTENDANCE) || hasPermission(user, PERM.MANAGE_USERS);
}

export async function getPayrollLockStateAction(f: ReportFilters): Promise<boolean> {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
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
  if (!canManagePayrollLock(appUser)) {
    throw new Error("ليس لديك صلاحية اعتماد المسير.");
  }
  await approvePayrollPeriodRpc(f, appUser.id);
}

export async function unlockPayrollPeriodAction(f: ReportFilters) {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!canManagePayrollLock(appUser)) {
    throw new Error("ليس لديك صلاحية إلغاء قفل المسير.");
  }
  await unlockPayrollPeriodRpc(f);
}

export async function importPayrollDeductionsAction(payload: {
  rows: Array<{ workerId: number; amountSar: number }>;
  periodStart: string;
  periodEnd: string;
  filter: Pick<ReportFilters, "siteIds" | "contractorIds" | "supervisorIds">;
}) {
  const { appUser } = await getSessionContext();
  if (!appUser) throw new Error("غير مصرح");
  if (!payload.periodStart || !payload.periodEnd) throw new Error("فترة غير صالحة");
  let ok = 0;
  for (const r of payload.rows) {
    if (!Number.isFinite(r.workerId)) continue;
    await upsertPayrollManualDeduction(
      r.workerId,
      payload.periodStart,
      payload.periodEnd,
      r.amountSar,
      payload.filter,
    );
    ok += 1;
  }
  return { imported: ok };
}

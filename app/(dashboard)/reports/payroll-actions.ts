"use server";

import { getSessionContext } from "@/lib/auth/session";
import { upsertPayrollManualDeduction } from "@/lib/reports/queries";

export async function savePayrollManualDeductionAction(payload: {
  workerId: number;
  periodStart: string;
  periodEnd: string;
  amountSar: number;
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
  );
}

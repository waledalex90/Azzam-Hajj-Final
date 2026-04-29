/** نطاق عرض قائمة التحضير في صفحة الحضور */
export type PrepShiftScope = "all" | 1 | 2;

/** من باراميتر `shift` في URL: 0 | all | كل → كل الورديات؛ 2 → مسائي؛ وغير ذلك → صباحي */
export function parseAttendancePrepShiftParam(shift: string | undefined): PrepShiftScope {
  const s = (shift ?? "").trim().toLowerCase();
  if (s === "0" || s === "all" || s === "كل") return "all";
  const n = Number(shift);
  if (n === 2) return 2;
  return 1;
}

export function attendancePrepShiftToQuery(scope: PrepShiftScope): string {
  return scope === "all" ? "0" : String(scope);
}

/**
 * شاشة الاعتماد: نفس قيم باراميتر `shift` مثل التحضير؛ «كل الورديات» مسموحة فقط عند تمكين الواجهة (مثل مدير النظام ذي صلاحية `*`).
 * غير ذلك يُحمَّل كصباحي إن كان الرابط غير مصرّح له.
 */
export function parseApprovalShiftFromParam(
  shift: string | undefined,
  allowAllShiftsOption: boolean,
): { kind: "all" } | { kind: "round"; round: 1 | 2 } {
  const prep = parseAttendancePrepShiftParam(shift);
  if (prep === "all") {
    if (allowAllShiftsOption) return { kind: "all" };
    return { kind: "round", round: 1 };
  }
  return { kind: "round", round: prep === 2 ? 2 : 1 };
}

/** وردية التحضير الفعلية للعامل حسب السجل: NULL أو غير 2 → صباحي */
export function effectivePrepRoundForWorker(shift_round: number | null | undefined): 1 | 2 {
  return Number(shift_round) === 2 ? 2 : 1;
}

/** من رموز المصفوفة (ح/غ/ن) — أيام معادلة: حاضر = 1، نصف يوم = 0.5 */
export function presentEquivalentDaysFromSymbols(byDay: Record<string, string>): number {
  let present = 0;
  let half = 0;
  for (const v of Object.values(byDay)) {
    if (v === "ح") present += 1;
    if (v === "ن") half += 1;
  }
  return present + half * 0.5;
}

export function formatEquivalentDays(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

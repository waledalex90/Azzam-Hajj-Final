/** Parse comma-separated IDs or empty → null (means: no filter / all). */
export function parseIdList(raw: string | null | undefined): number[] | null {
  if (raw == null || String(raw).trim() === "") return null;
  const parts = String(raw)
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return parts.length === 0 ? null : parts;
}

export function serializeIdList(ids: number[] | null): string {
  if (!ids || ids.length === 0) return "";
  return ids.join(",");
}

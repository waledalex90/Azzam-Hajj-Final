const AR = "٠١٢٣٤٥٦٧٨٩";
const EN = "0123456789";

/** Normalize for instant client-side name/ID matching (Arabic digits → Latin, NFC, lower). */
export function normalizeForClientSearch(value: unknown): string {
  let s = String(value ?? "")
    .trim()
    .normalize("NFC");
  for (let i = 0; i < 10; i += 1) {
    s = s.split(AR[i]).join(EN[i]);
  }
  return s.toLowerCase();
}

export function matchesClientSearch(haystackName: unknown, haystackId: unknown, needle: string): boolean {
  const n = normalizeForClientSearch(needle);
  if (!n) return true;
  const name = normalizeForClientSearch(haystackName);
  const id = normalizeForClientSearch(haystackId);
  return name.includes(n) || id.includes(n);
}

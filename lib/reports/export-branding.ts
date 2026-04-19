import fs from "node:fs";
import path from "node:path";

/** مسارات محتملة لشعار الشركة في التصدير — ضع الملف في public */
const LOGO_CANDIDATES = ["company-logo.png", "payroll-logo.png", "logo.png"] as const;

export type ExportLogoFile = { absPath: string; format: "PNG" | "JPEG" };

export function findCompanyLogoFile(): ExportLogoFile | null {
  const root = process.cwd();
  for (const name of LOGO_CANDIDATES) {
    const absPath = path.join(root, "public", name);
    if (!fs.existsSync(absPath)) continue;
    const lower = absPath.toLowerCase();
    if (lower.endsWith(".png")) return { absPath, format: "PNG" };
    if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return { absPath, format: "JPEG" };
  }
  return null;
}

export function readCompanyLogoBuffer(): { buffer: Buffer; format: "PNG" | "JPEG" } | null {
  const f = findCompanyLogoFile();
  if (!f) return null;
  try {
    return { buffer: fs.readFileSync(f.absPath), format: f.format };
  } catch {
    return null;
  }
}

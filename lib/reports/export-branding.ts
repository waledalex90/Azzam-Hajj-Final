import fs from "node:fs";
import path from "node:path";

/** أسماء ملفات محتملة (حساسية مختلفة للأنظمة) */
const LOGO_NAMES = [
  "company-logo.png",
  "Company-Logo.png",
  "company-logo.jpg",
  "payroll-logo.png",
  "logo.png",
  "logo.jpg",
] as const;

export type ExportLogoFile = { absPath: string; format: "PNG" | "JPEG" };

function formatFromPath(absPath: string): "PNG" | "JPEG" | null {
  const lower = absPath.toLowerCase();
  if (lower.endsWith(".png")) return "PNG";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPEG";
  return null;
}

/** جذور بحث عن مجلد public (cwd يختلف بين التطوير والنشر) */
function publicSearchRoots(): string[] {
  const cwd = process.cwd();
  const roots = new Set<string>();
  roots.add(cwd);
  roots.add(path.join(cwd, ".."));
  roots.add(path.join(cwd, "azzam-hajj-system"));
  if (process.env.PROJECT_ROOT) {
    roots.add(process.env.PROJECT_ROOT);
  }
  return [...roots];
}

/**
 * مسار شعار الشركة للتصدير.
 * - ضع الملف تحت `public/` (مثل public/company-logo.png)
 * - أو عيّن متغير بيئة `COMPANY_LOGO_ABS_PATH` لمسار ملف كامل
 */
export function findCompanyLogoFile(): ExportLogoFile | null {
  const envPath = process.env.COMPANY_LOGO_ABS_PATH?.trim();
  if (envPath && fs.existsSync(envPath)) {
    const fmt = formatFromPath(envPath);
    if (fmt) return { absPath: envPath, format: fmt };
  }

  for (const root of publicSearchRoots()) {
    for (const name of LOGO_NAMES) {
      const absPath = path.join(root, "public", name);
      if (!fs.existsSync(absPath)) continue;
      const fmt = formatFromPath(absPath);
      if (fmt) return { absPath, format: fmt };
    }
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

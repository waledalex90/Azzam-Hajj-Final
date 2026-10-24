import fs from "node:fs";
import path from "node:path";

/** شعار المنتج للتصدير — SVG/PNG عام، بدون هوية جهة عمل. */
const LOGO_NAMES = [
  "brand/workforce-hub-mark.svg",
  "icons/app-icon.svg",
  "company-logo.png",
  "logo.png",
] as const;

export type ExportLogoFile = { absPath: string; format: "PNG" | "JPEG" | "SVG" };

function formatFromPath(absPath: string): "PNG" | "JPEG" | "SVG" | null {
  const lower = absPath.toLowerCase();
  if (lower.endsWith(".svg")) return "SVG";
  if (lower.endsWith(".png")) return "PNG";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "JPEG";
  return null;
}

function publicSearchRoots(): string[] {
  const cwd = process.cwd();
  const roots = new Set<string>();
  roots.add(cwd);
  roots.add(path.join(cwd, ".."));
  if (process.env.PROJECT_ROOT) {
    roots.add(process.env.PROJECT_ROOT);
  }
  return [...roots];
}

/**
 * مسار شعار المنتج للتصدير.
 * عيّن `COMPANY_LOGO_ABS_PATH` لمسار مخصص إن لزم.
 * لا يُبحث عن شعارات جهات العمل القديمة.
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

export function readCompanyLogoBuffer(): { buffer: Buffer; format: "PNG" | "JPEG" | "SVG" } | null {
  const f = findCompanyLogoFile();
  if (!f) return null;
  if (f.format === "SVG") return null;
  try {
    return { buffer: fs.readFileSync(f.absPath), format: f.format };
  } catch {
    return null;
  }
}

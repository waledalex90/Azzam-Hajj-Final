/**
 * يولّد أيقونات PWA من شعار Workforce Hub (SVG).
 */
import sharp from "sharp";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public/icons/app-icon.svg");
const iconsDir = join(root, "public/icons");

async function main() {
  mkdirSync(iconsDir, { recursive: true });
  const svg = readFileSync(svgPath);
  await sharp(svg).resize(512, 512).png().toFile(join(iconsDir, "pwa-512.png"));
  await sharp(svg).resize(192, 192).png().toFile(join(iconsDir, "pwa-192.png"));
  await sharp(svg).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

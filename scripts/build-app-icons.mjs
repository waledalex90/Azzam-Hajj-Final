/**
 * توليد أيقونات PWA / Apple + ملفات PNG جاهزة للتحميل (ويندوز/هاتف) في public/brand:
 *   - azzam-luxury-badge-1024.png  — مربع عالي الدقة
 *   - azzam-luxury-badge-256.png   — أيقونات صغيرة / اختصارات
 * نفس المظهر: #0b0b0c + حد ذهبي + azzam-logo.png
 * يشغّل عند `npm run build:icons` أو من `prebuild` مع البناء.
 */
import sharp from "sharp";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const logoPath = join(root, "public/brand/azzam-logo.png");
const iconsDir = join(root, "public/icons");
const brandDir = join(root, "public/brand");

const W = 512;
const LOGO_W = 456;
const LOGO_X = 28;
const LOGO_Y = 174;

const frameSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
  <rect width="${W}" height="${W}" rx="96" fill="#0b0b0c" stroke="#d4af37" stroke-width="6"/>
</svg>`;

function buildSvgDataUri(logoB64) {
  const h = Math.round((LOGO_W * 287) / 799);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="نظام عزام للحج">
  <rect width="${W}" height="${W}" rx="96" fill="#0b0b0c" stroke="#d4af37" stroke-width="6"/>
  <image
    width="${LOGO_W}"
    height="${h}"
    x="${LOGO_X}"
    y="${LOGO_Y}"
    href="data:image/png;base64,${logoB64}"
    xlink:href="data:image/png;base64,${logoB64}"
    preserveAspectRatio="xMidYMid meet"
  />
</svg>
`;
}

async function main() {
  mkdirSync(iconsDir, { recursive: true });
  mkdirSync(brandDir, { recursive: true });
  const logoB64 = readFileSync(logoPath).toString("base64");
  const svgOut = buildSvgDataUri(logoB64);
  writeFileSync(join(iconsDir, "azzam-app-icon.svg"), svgOut, "utf8");

  const basePng = await sharp(Buffer.from(frameSvg)).png().toBuffer();
  const logoPng = await sharp(logoPath)
    .resize({ width: LOGO_W, withoutEnlargement: true })
    .png()
    .toBuffer();

  const full512 = await sharp(basePng)
    .composite([{ input: logoPng, top: LOGO_Y, left: LOGO_X }])
    .png()
    .toBuffer();

  await sharp(full512).png().toFile(join(iconsDir, "azzam-pwa-512.png"));
  await sharp(full512).resize(192, 192).png().toFile(join(iconsDir, "azzam-pwa-192.png"));
  await sharp(full512).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));

  // نسخ للمشروع: تحميل يدوي — ويندوز (اختصار سطح مكتب، مجلد) + هاتف (مشاركة، خلفية، إلخ)
  const hq = await sharp(full512)
    .resize(1024, 1024, { kernel: sharp.kernel.lanczos3 })
    .png({ compressionLevel: 9, effort: 7 })
    .toBuffer();
  writeFileSync(join(brandDir, "azzam-luxury-badge-1024.png"), hq);
  writeFileSync(
    join(brandDir, "azzam-luxury-badge-256.png"),
    await sharp(hq).resize(256, 256, { kernel: sharp.kernel.lanczos3 }).png({ compressionLevel: 9 }).toBuffer(),
  );
  // نسخة باسم ثابت سهل النسخ
  writeFileSync(join(brandDir, "azzam-luxury-badge.png"), hq);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

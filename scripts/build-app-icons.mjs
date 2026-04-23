/**
 * - أيقونات PWA مربعة 512 (أسود+ذهبي) كما هي.
 * - ملفات brand للتحميل: **مستطيلة** بنسب الشعار + نفس padding/الانسيابية الحالية في الـ UI (px-3 py-2.5, rounded-2xl, border-2).
 * - دمج الشعار على #0b0b0c لتقليل الحواف البيضاء/الفاتحة عند استخدامه كخلفية.
 * يشغّل: npm run build:icons | ويدمج في npm run build
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

const BG = { r: 11, g: 11, b: 12 }; /* #0b0b0c */
const GOLD = "#d4af37";
const RATIO = 287 / 799;

/** تطبيع مع Tailwind: عرض لوجو مرجعي 300px في التصميم */
const UI_REF_LOGO_W = 300;
const PADDING_X_300 = 12; /* px-3 */
const PADDING_Y_300 = 10; /* py-2.5 */
const BORDER_300 = 2; /* border-2 */
const RADIUS_300 = 16; /* rounded-2xl = 1rem */

const W = 512;
const PWA_LOGO_W = 456;
const PWA_LOGO_X = 28;
const PWA_LOGO_Y = 174;

const frameSquareSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}">
  <rect width="${W}" height="${W}" rx="96" fill="#0b0b0c" stroke="${GOLD}" stroke-width="6"/>
</svg>`;

function buildPwaSvgDataUri(logoB64) {
  const h = Math.round((PWA_LOGO_W * 287) / 799);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${W}" width="${W}" height="${W}" role="img" aria-label="نظام عزام للحج">
  <rect width="${W}" height="${W}" rx="96" fill="#0b0b0c" stroke="${GOLD}" stroke-width="6"/>
  <image
    width="${PWA_LOGO_W}"
    height="${h}"
    x="${PWA_LOGO_X}"
    y="${PWA_LOGO_Y}"
    href="data:image/png;base64,${logoB64}"
    xlink:href="data:image/png;base64,${logoB64}"
    preserveAspectRatio="xMidYMid meet"
  />
</svg>
`;
}

/**
 * شعار مُركّب على بكسل بإزاحة (بدون حواف بيضاء شفافة).
 */
async function renderLogoSynthesized(logoW) {
  const logoH = Math.max(1, Math.round(logoW * RATIO));
  const onBlack = await sharp(logoPath)
    .ensureAlpha()
    .resize(logoW, logoH, { fit: "fill", kernel: sharp.kernel.lanczos3 })
    .toBuffer();
  return sharp({ create: { width: logoW, height: logoH, background: { ...BG, alpha: 1 }, channels: 4 } })
    .png()
    .composite([{ input: onBlack, left: 0, top: 0 }])
    .png()
    .toBuffer();
}

/**
 * ملصق مستطيل: نسب شعار 799:287 + padding/border مثل `BrandLogo` (uiShell).
 */
async function buildRectangularLuxuryPng(logoContentW) {
  const logoH = Math.max(1, Math.round(logoContentW * RATIO));
  const scale = logoContentW / UI_REF_LOGO_W;
  const padX = Math.round(PADDING_X_300 * scale);
  const padY = Math.round(PADDING_Y_300 * scale);
  const borderW = Math.max(1, Math.round(BORDER_300 * scale));
  const rx = Math.max(2, Math.round(RADIUS_300 * scale));

  const contentW = logoContentW + 2 * padX;
  const contentH = logoH + 2 * padY;
  const totalW = contentW + 2 * borderW;
  const totalH = contentH + 2 * borderW;
  const logoX = borderW + padX;
  const logoY = borderW + padY;

  const frameSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalW} ${totalH}" width="${totalW}" height="${totalH}">
  <rect width="${totalW}" height="${totalH}" rx="${rx}" fill="#0b0b0c" stroke="${GOLD}" stroke-width="${borderW}"/>
</svg>`;

  const basePng = await sharp(Buffer.from(frameSvg))
    .png()
    .toBuffer();
  const logoPng = await renderLogoSynthesized(logoContentW);

  return sharp(basePng)
    .composite([{ input: logoPng, top: logoY, left: logoX }])
    .png({ compressionLevel: 9, effort: 9 })
    .toBuffer();
}

async function main() {
  mkdirSync(iconsDir, { recursive: true });
  mkdirSync(brandDir, { recursive: true });
  const logoB64 = readFileSync(logoPath).toString("base64");
  const svgPwa = buildPwaSvgDataUri(logoB64);
  writeFileSync(join(iconsDir, "azzam-app-icon.svg"), svgPwa, "utf8");

  const basePng = await sharp(Buffer.from(frameSquareSvg)).png().toBuffer();
  const logoPwa = await sharp(logoPath)
    .resize({ width: PWA_LOGO_W, withoutEnlargement: true })
    .png()
    .toBuffer();

  const full512 = await sharp(basePng)
    .composite([{ input: logoPwa, top: PWA_LOGO_Y, left: PWA_LOGO_X }])
    .png()
    .toBuffer();

  await sharp(full512).png().toFile(join(iconsDir, "azzam-pwa-512.png"));
  await sharp(full512).resize(192, 192).png().toFile(join(iconsDir, "azzam-pwa-192.png"));
  await sharp(full512).resize(180, 180).png().toFile(join(iconsDir, "apple-touch-icon.png"));

  /* === تحميل: مستطيل عالي جودة (خلفية ويندوز/هاتف) — نسب الشعار + انسيابية الـ UI === */
  const ULTRA = 5120; /* ~5K عرض لمحتوى الشعار */
  const uhd = await buildRectangularLuxuryPng(ULTRA);
  const q2k = await buildRectangularLuxuryPng(2560);
  const fhd = await buildRectangularLuxuryPng(1920);
  const phone = await buildRectangularLuxuryPng(1440);

  writeFileSync(join(brandDir, "azzam-luxury-badge.png"), uhd);
  writeFileSync(join(brandDir, "azzam-luxury-badge-5k.png"), uhd);
  writeFileSync(join(brandDir, "azzam-luxury-badge-2k.png"), q2k);
  writeFileSync(join(brandDir, "azzam-luxury-badge-1080p.png"), fhd);
  writeFileSync(join(brandDir, "azzam-luxury-badge-phone.png"), phone);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

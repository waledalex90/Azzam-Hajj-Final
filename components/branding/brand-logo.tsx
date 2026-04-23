import Image from "next/image";
import { clsx } from "clsx";

type Props = {
  className?: string;
  priority?: boolean;
  /** إطار أسود مطعّم بالذهبي — يُلائم عرض اللوجو بلون ذهبي فخم على خلفية داكنة */
  framed?: boolean;
  /**
   * - `light`: خلفية فاتحة (افتراضي) — تُبقى ألوان الملف كما في المصدر.
   * - `dark`: خلفية داكنة/إطار ذهبي — تضييع ذهبي خفيف يتناسب مع واجهة النظام.
   */
  surface?: "light" | "dark";
};

const chicFrameClass =
  "inline-flex shrink-0 items-center justify-center rounded-2xl border-2 border-[#d4af37] bg-[#0b0b0c] px-3 py-2.5 shadow-[0_0_0_1px_rgba(212,175,55,0.14),0_12px_32px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]";

/** 799×287 — نسبة اللوجو الرسمي من abn.sa.com */
const LOGO_W = 799;
const LOGO_H = 287;

export function BrandLogo({ className, priority = false, framed = false, surface }: Props) {
  const effectiveSurface: "light" | "dark" = surface ?? (framed ? "dark" : "light");

  const img = (
    <Image
      src="/brand/azzam-logo.png"
      alt="شعار شركة عزام"
      width={LOGO_W}
      height={LOGO_H}
      unoptimized
      priority={priority}
      className={clsx(
        "h-auto w-[180px] object-contain object-center sm:w-[220px]",
        effectiveSurface === "dark" &&
          "[filter:drop-shadow(0_0_22px_rgba(212,175,55,0.4))_brightness(1.12)_saturate(1.15)_contrast(1.05)]",
        className,
      )}
    />
  );

  if (!framed) return img;

  return <div className={chicFrameClass}>{img}</div>;
}

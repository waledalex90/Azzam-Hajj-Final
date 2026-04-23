import Image from "next/image";
import { clsx } from "clsx";

import { brandLogo } from "@/lib/branding/logo-sizes";

type Preset = keyof typeof brandLogo;

type Props = {
  className?: string;
  priority?: boolean;
  /** إطار أسود مزدوج مع ذهب — نماذج رسمية / طباعة */
  framed?: boolean;
  /**
   * غلاف أسود عميق + حدّ ذهبي حول نفس ملف `azzam-logo.png` — الافتراضي في الواجهة.
   * عطّله للعرض على ورق أبيض (إشعارات) أو عند وضعك للوجو داخل حاوية مخصصة.
   */
  royalPad?: boolean;
  /** أبعاد موحّدة — الافتراضي `app` */
  preset?: Preset;
};

/** إطار فاخر للوثائق */
const chicFrameClass =
  "inline-flex shrink-0 items-center justify-center rounded-2xl border-2 border-[#d4af37] bg-[#0b0b0c] px-3 py-2.5 shadow-[0_0_0_1px_rgba(212,175,55,0.14),0_12px_32px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]";

/** نفس فكرة الشاشات: لوجو على خلفية سوداء مع لمعان ذهبي خفيف */
const royalPadClass =
  "mx-auto w-fit max-w-full rounded-2xl bg-[#050506] p-3 ring-1 ring-inset ring-[#d4af37]/35 shadow-[0_0_36px_-10px_rgba(212,175,55,0.18),0_12px_40px_-12px_rgba(0,0,0,0.55)]";

const LOGO_W = 799;
const LOGO_H = 287;

export function BrandLogo({ className, priority = false, framed = false, royalPad = true, preset = "app" }: Props) {
  const img = (
    <Image
      src="/brand/azzam-logo.png"
      alt="شعار شركة عزام"
      width={LOGO_W}
      height={LOGO_H}
      unoptimized
      priority={priority}
      className={clsx(brandLogo[preset], className)}
    />
  );

  if (framed) {
    return <div className={chicFrameClass}>{img}</div>;
  }
  if (royalPad) {
    return <div className={royalPadClass}>{img}</div>;
  }
  return img;
}

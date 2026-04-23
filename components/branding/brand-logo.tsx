import Image from "next/image";
import { clsx } from "clsx";

import { brandLogo } from "@/lib/branding/logo-sizes";

type Preset = keyof typeof brandLogo;

type Props = {
  className?: string;
  priority?: boolean;
  /** إطار اختياري للنماذج المطبوعة */
  framed?: boolean;
  preset?: Preset;
};

/** إطار اختياري لنسخ مطبوعة — أبيض/حد سُلت مثل باقي واجهة جسر */
const printFrameClass =
  "inline-flex shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm";

const LOGO_W = 799;
const LOGO_H = 287;

export function BrandLogo({ className, priority = false, framed = false, preset = "app" }: Props) {
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
    return <div className={printFrameClass}>{img}</div>;
  }
  return img;
}

import Image from "next/image";
import { clsx } from "clsx";

import { brandLogo } from "@/lib/branding/logo-sizes";

type Preset = keyof typeof brandLogo;

type Props = {
  className?: string;
  priority?: boolean;
  preset?: Preset;
  /**
   * `ui` — شعار داخل البرنامج/الدخول: خلفية سوداء فخمة + إطار ذهبي (لا يغيّر باقي الصفحة).
   * `document` — نسخ مطبوعة/رسمية: صورة فقط بلا إطار (ورقة بيضاء).
   */
  surface?: "ui" | "document";
};

const uiShellClass =
  "inline-flex w-fit max-w-full shrink-0 items-center justify-center rounded-2xl border-2 border-[#d4af37] bg-[#0b0b0c] px-3 py-2.5 shadow-[0_0_0_1px_rgba(212,175,55,0.14),0_12px_32px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]";

const LOGO_W = 799;
const LOGO_H = 287;

export function BrandLogo({ className, priority = false, preset = "app", surface = "ui" }: Props) {
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

  if (surface === "document") {
    return img;
  }
  return <div className={uiShellClass}>{img}</div>;
}

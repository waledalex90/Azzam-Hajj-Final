import Image from "next/image";
import { clsx } from "clsx";

type Props = {
  className?: string;
  priority?: boolean;
  /** إطار أسود مطعّم بالذهبي؛ عطّله للمستندات المطبوعة ذات الخلفية البيضاء */
  framed?: boolean;
};

const chicFrameClass =
  "inline-flex shrink-0 items-center justify-center rounded-2xl border-2 border-[#d4af37] bg-[#0b0b0c] px-3 py-2.5 shadow-[0_0_0_1px_rgba(212,175,55,0.14),0_12px_32px_-8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.05)]";

export function BrandLogo({ className, priority = false, framed = false }: Props) {
  const img = (
    <Image
      src="/brand/azzam-wordmark.svg"
      alt="شعار شركة عزام"
      width={320}
      height={168}
      unoptimized
      priority={priority}
      className={clsx("h-auto w-[180px] sm:w-[220px]", className)}
    />
  );

  if (!framed) return img;

  return <div className={chicFrameClass}>{img}</div>;
}

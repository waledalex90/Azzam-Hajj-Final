import Image from "next/image";
import { clsx } from "clsx";

type Props = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: Props) {
  return (
    <Image
      src="https://abn.sa.com/wp-content/uploads/2022/01/logo-removebg-preview.png"
      alt="شعار شركة عزام"
      width={210}
      height={70}
      priority={priority}
      className={clsx("h-auto w-[150px] sm:w-[190px]", className)}
    />
  );
}

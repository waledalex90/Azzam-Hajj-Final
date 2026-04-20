import Image from "next/image";
import { clsx } from "clsx";

type Props = {
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ className, priority = false }: Props) {
  return (
    <Image
      src="/icons/abn-icon-512.svg"
      alt="شعار ABN عزام"
      width={512}
      height={512}
      priority={priority}
      className={clsx("h-auto w-11 shrink-0 sm:w-12", className)}
    />
  );
}

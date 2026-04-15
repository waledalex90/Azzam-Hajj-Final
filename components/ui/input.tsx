import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={clsx(
        "min-h-12 w-full rounded-xl border border-[#b88b2f] bg-[#1a1a1c] px-4 py-3 text-base text-[#f4ecd7] outline-none transition-all duration-200 placeholder:text-[#9f987f] focus:border-[#d4af37] focus:ring-2 focus:ring-[#3a2d0f]",
        className,
      )}
      {...props}
    />
  );
}

import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={clsx(
        "min-h-12 w-full rounded-xl border border-[#3a3428] bg-[#121214] px-4 py-3 text-base text-[#f0ead8] outline-none transition-all duration-200 placeholder:text-[#6a6048] focus:border-[#c9a227] focus:ring-2 focus:ring-[#c9a227]/25",
        className,
      )}
      {...props}
    />
  );
}

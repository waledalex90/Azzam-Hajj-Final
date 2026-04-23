import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={clsx(
        "min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base outline-none transition-all duration-200 focus:border-[#166534] focus:ring-2 focus:ring-[#f5efda]",
        className,
      )}
      {...props}
    />
  );
}

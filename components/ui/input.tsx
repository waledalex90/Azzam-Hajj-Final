import type { InputHTMLAttributes } from "react";
import { clsx } from "clsx";

type Props = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...props }: Props) {
  return (
    <input
      className={clsx(
        "min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base outline-none transition focus:border-[#14532d] focus:ring-2 focus:ring-[#f8f3df]",
        className,
      )}
      {...props}
    />
  );
}

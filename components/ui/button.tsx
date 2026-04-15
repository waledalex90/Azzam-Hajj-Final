import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[#d4af37] text-[#0b0b0c] hover:bg-[#e2c35b] shadow-sm hover:shadow-md",
  secondary: "bg-[#1a1a1c] text-[#f6e5a8] border border-[#b88b2f] hover:bg-[#232325] shadow-sm",
  danger: "bg-red-700 text-white hover:bg-red-800 shadow-sm hover:shadow-md",
  ghost: "bg-transparent text-[#f6e5a8] hover:bg-[#1b1b1d] border border-[#b88b2f]",
};

export function Button({ variant = "primary", className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-base font-extrabold transition-all duration-200 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[#166534] text-white hover:bg-[#14532d] shadow-sm hover:shadow-md",
  secondary: "bg-[#f5efda] text-[#14532d] hover:bg-[#eee2be] shadow-sm",
  danger: "bg-red-700 text-white hover:bg-red-800 shadow-sm hover:shadow-md",
  ghost: "bg-transparent text-[#166534] hover:bg-[#f5efda]",
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

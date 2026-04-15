import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
};

const variants: Record<ButtonVariant, string> = {
  primary: "bg-[#14532d] text-white hover:bg-[#0f3f21]",
  secondary: "bg-[#f8f3df] text-[#14532d] hover:bg-[#efe4bf]",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "bg-transparent text-[#14532d] hover:bg-[#f8f3df]",
};

export function Button({ variant = "primary", className, children, ...props }: Props) {
  return (
    <button
      className={clsx(
        "inline-flex min-h-12 items-center justify-center rounded-lg px-5 py-3 text-base font-extrabold transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60",
        variants[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

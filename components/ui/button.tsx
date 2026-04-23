import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  children: ReactNode;
  /** يعطّل الزر ويعرض مؤشر تحميل — للإجراءات غير المتزامنة */
  pending?: boolean;
};

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-[#c9a227] text-[#0a0a0a] shadow-md ring-2 ring-[#d4af37]/40 hover:bg-[#d4af37] hover:shadow-lg focus-visible:outline-none focus-visible:ring-[#d4af37]/50",
  secondary: "bg-[#1a1914] text-[#e8d4a8] hover:bg-[#222018] shadow-sm border border-[#3d3420]",
  danger: "bg-red-800 text-white hover:bg-red-900 shadow-sm hover:shadow-md",
  ghost: "bg-transparent text-[#b8a878] hover:bg-[#1a1508] hover:text-[#f6e8b8]",
};

export function Button({ variant = "primary", className, children, pending, disabled, ...props }: Props) {
  const busy = Boolean(pending);
  return (
    <button
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={clsx(
        "inline-flex min-h-12 items-center justify-center rounded-xl px-5 py-3 text-base font-extrabold transition-[transform,opacity,box-shadow] duration-150 disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.98]",
        variants[variant],
        className,
      )}
      {...props}
    >
      {busy ? <Loader2 className="me-2 inline-block h-4 w-4 shrink-0 animate-spin" aria-hidden /> : null}
      {children}
    </button>
  );
}

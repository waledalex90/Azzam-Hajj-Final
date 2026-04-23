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
    "bg-[#14532d] text-white shadow-md ring-2 ring-[#14532d]/35 hover:bg-[#166534] hover:shadow-lg focus-visible:outline-none focus-visible:ring-[#166534]/50",
  secondary: "bg-slate-100 text-slate-700 hover:bg-slate-200/90 shadow-sm border border-slate-200/80",
  danger: "bg-red-700 text-white hover:bg-red-800 shadow-sm hover:shadow-md",
  ghost: "bg-transparent text-slate-600 hover:bg-slate-100 hover:text-[#14532d]",
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

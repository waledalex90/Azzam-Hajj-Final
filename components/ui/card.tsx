import type { ReactNode } from "react";
import { clsx } from "clsx";

type Props = {
  children: ReactNode;
  className?: string;
};

export function Card({ children, className }: Props) {
  return <div className={clsx("card p-4 sm:rounded-2xl sm:p-5", className)}>{children}</div>;
}

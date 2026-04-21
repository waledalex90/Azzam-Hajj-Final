"use client";

import type { ReactNode } from "react";

import { GlobalActionLockProvider } from "@/components/providers/global-action-lock-context";
import { SonnerToaster } from "@/components/ui/sonner-toaster";

export function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <GlobalActionLockProvider>
      <SonnerToaster />
      {children}
    </GlobalActionLockProvider>
  );
}

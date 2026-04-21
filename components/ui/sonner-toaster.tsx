"use client";

import { Toaster } from "sonner";
import "sonner/dist/styles.css";

export function SonnerToaster() {
  return (
    <Toaster
      position="top-center"
      richColors
      dir="rtl"
      closeButton
      style={{ zIndex: 10050 }}
      toastOptions={{
        duration: 4200,
        classNames: {
          toast: "font-extrabold shadow-lg",
          success: "!border-emerald-600",
          error: "!border-red-600",
        },
      }}
    />
  );
}

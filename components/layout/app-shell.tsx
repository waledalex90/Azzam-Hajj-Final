"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";

import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { LogoutButton } from "@/components/layout/logout-button";
import { PRODUCT_NAME } from "@/lib/product";
import type { AppUser } from "@/lib/types/db";

export function AppShell({ user, demo, children }: { user: AppUser; demo: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] lg:flex">
      <div className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-slate-200 bg-[#0B1730] px-4 py-3 text-white lg:hidden">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"
          onClick={() => setOpen(true)}
          aria-label="فتح القائمة"
        >
          <Menu className="h-5 w-5" />
        </button>
        <p className="text-sm font-bold">{PRODUCT_NAME}</p>
        <LogoutButton compact />
      </div>

      {open ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="إغلاق القائمة"
          onClick={() => setOpen(false)}
        />
      ) : null}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-[min(86vw,280px)] overflow-y-auto bg-white shadow-2xl transition-transform duration-200 lg:static lg:z-0 lg:w-[260px] lg:translate-x-0 lg:shadow-none ${
          open ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="flex justify-end p-3 lg:hidden">
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AdminSidebar user={user} onNavigate={() => setOpen(false)} />
      </div>

      <main className="flex-1 p-4 lg:p-6">
        <div className="mx-auto w-full max-w-[1200px] space-y-4">
          <div className="no-print hidden items-center justify-end lg:flex">
            <LogoutButton />
          </div>
          {demo ? (
            <div className="no-print rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
              نسخة عرض Demo — التعديلات لا تُحفظ على بيانات التشغيل.
            </div>
          ) : null}
          {children}
        </div>
      </main>
    </div>
  );
}

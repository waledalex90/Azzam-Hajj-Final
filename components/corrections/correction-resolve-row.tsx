"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { resolveCorrectionRequest } from "@/app/(dashboard)/corrections/actions";

type Props = {
  requestId: number;
  workerLabel: string;
  metaLine: string;
  reason: string;
};

export function CorrectionResolveRow({ requestId, workerLabel, metaLine, reason }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function apply(status: "present" | "absent") {
    if (busy) return;
    setBusy(true);
    try {
      const res = await resolveCorrectionRequest(requestId, status);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم التعديل ✅");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="text-sm">
        <p className="font-bold text-slate-800">{workerLabel}</p>
        <p className="text-xs text-slate-500">{metaLine}</p>
        <p className="mt-1 text-xs text-slate-700">السبب: {reason || "—"}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void apply("present")}
          className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          تغيير لـ: حاضر
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void apply("absent")}
          className="rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
        >
          تغيير لـ: غائب
        </button>
      </div>
    </div>
  );
}

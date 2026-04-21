"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { cancelHalfDayAttendancePrep } from "@/app/(dashboard)/attendance/review-tab-actions";

type Props = {
  checkId: number;
};

export function CancelHalfDayPrepButton({ checkId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const ok = window.confirm(
      "حذف السجل المعلّق وإرجاع العامل إلى «الموظفون والتحضير» لإعادة التحضير كحاضر أو غائب؟",
    );
    if (!ok) return;

    startTransition(async () => {
      const fd = new FormData();
      fd.set("checkId", String(checkId));
      const res = await cancelHalfDayAttendancePrep(fd);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم حذف السجل — يمكن إعادة تحضير العامل.");
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="mt-2 w-full rounded border border-amber-800/60 bg-amber-50 px-2 py-1.5 text-[11px] font-extrabold text-amber-950 hover:bg-amber-100 disabled:opacity-50 md:mt-0 md:w-auto"
    >
      {pending ? "…" : "إرجاع للتحضير (سجل قديم)"}
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { submitAttendanceCorrectionRequestFromReview } from "@/app/(dashboard)/attendance/review-actions";

type Status = "present" | "absent" | "half";

type Props = {
  checkId: number;
};

export function ReviewCorrectionRequestModal({ checkId }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [requestedStatus, setRequestedStatus] = useState<Status>("present");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const res = await submitAttendanceCorrectionRequestFromReview({
        checkId,
        reason,
        requestedStatus,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم إرسال الطلب ✅");
      setOpen(false);
      setReason("");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded border border-amber-500 bg-amber-100 px-3 py-1.5 text-xs font-bold text-amber-950"
        onClick={() => setOpen(true)}
      >
        طلب تعديل
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <button type="button" className="absolute inset-0 bg-black/40" aria-label="إغلاق" onClick={() => !pending && setOpen(false)} />
          <div className="relative z-10 w-full max-w-sm rounded border-2 border-slate-400 bg-white p-4 shadow-md">
            <h3 className="text-sm font-bold">طلب تعديل حضور</h3>
            <form className="mt-3 space-y-2" onSubmit={(e) => void onSubmit(e)}>
              <div>
                <label className="text-xs font-bold">السبب</label>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="mt-1 w-full border border-slate-400 px-2 py-1.5 text-sm"
                  disabled={pending}
                />
              </div>
              <div>
                <label className="text-xs font-bold">الحالة المطلوبة</label>
                <select
                  className="mt-1 w-full border border-slate-400 px-2 py-1.5 text-sm"
                  value={requestedStatus}
                  onChange={(e) => setRequestedStatus(e.target.value as Status)}
                  disabled={pending}
                >
                  <option value="present">حاضر</option>
                  <option value="absent">غائب</option>
                  <option value="half">نصف يوم</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" className="border border-slate-400 px-3 py-1 text-xs" disabled={pending} onClick={() => setOpen(false)}>
                  إلغاء
                </button>
                <button type="submit" className="bg-amber-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50" disabled={pending}>
                  {pending ? "…" : "إرسال"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

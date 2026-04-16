"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { submitAttendanceCorrectionRequestFromReview } from "@/app/(dashboard)/attendance/review-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
      <Button
        type="button"
        variant="secondary"
        className="border border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100"
        onClick={() => setOpen(true)}
      >
        طلب تعديل
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="إغلاق"
            onClick={() => !pending && setOpen(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl">
            <h3 className="text-base font-extrabold text-slate-900">طلب تعديل حضور</h3>
            <p className="mt-1 text-xs text-slate-600">أدخل السبب واختر الحالة المطلوبة بعد التصحيح.</p>
            <form className="mt-4 space-y-3" onSubmit={(e) => void onSubmit(e)}>
              <div>
                <label className="text-xs font-bold text-slate-700">السبب</label>
                <Input
                  name="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="سبب الطلب"
                  className="mt-1 min-h-10"
                  disabled={pending}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700">الحالة المطلوبة</label>
                <select
                  className="mt-1 min-h-12 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
                  value={requestedStatus}
                  onChange={(e) => setRequestedStatus(e.target.value as Status)}
                  disabled={pending}
                >
                  <option value="present">حاضر</option>
                  <option value="absent">غائب</option>
                  <option value="half">نصف يوم</option>
                </select>
              </div>
              <div className="flex flex-wrap justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>
                  إلغاء
                </Button>
                <Button type="submit" disabled={pending} className="bg-amber-600 text-white hover:bg-amber-700">
                  {pending ? "جاري الإرسال…" : "إرسال الطلب"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

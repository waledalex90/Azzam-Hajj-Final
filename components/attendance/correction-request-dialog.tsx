"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { submitAttendanceCorrectionRequestFromReview } from "@/app/(dashboard)/attendance/review-actions";

type Status = "present" | "absent" | "half";

export function CorrectionRequestDialog({ checkId }: { checkId: number }) {
  const dlg = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [requestedStatus, setRequestedStatus] = useState<Status>("present");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
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
      dlg.current?.close();
      setReason("");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="rounded border border-amber-600 bg-amber-100 px-2 py-1 text-xs font-bold text-amber-950"
        onClick={() => dlg.current?.showModal()}
      >
        طلب تعديل
      </button>
      <dialog ref={dlg} className="max-w-sm rounded border-2 border-slate-500 bg-white p-4 text-right shadow-lg backdrop:bg-black/40">
        <p className="text-sm font-bold">طلب تعديل حضور</p>
        <label className="mt-2 block text-xs font-bold">السبب</label>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-1 w-full border border-slate-400 px-2 py-1.5 text-sm"
          disabled={busy}
        />
        <label className="mt-2 block text-xs font-bold">الحالة المطلوبة</label>
        <select
          value={requestedStatus}
          onChange={(e) => setRequestedStatus(e.target.value as Status)}
          className="mt-1 w-full border border-slate-400 px-2 py-1.5 text-sm"
          disabled={busy}
        >
          <option value="present">حاضر</option>
          <option value="absent">غائب</option>
          <option value="half">نصف يوم</option>
        </select>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="border border-slate-400 px-3 py-1 text-xs"
            disabled={busy}
            onClick={() => dlg.current?.close()}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="bg-amber-600 px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "…" : "إرسال"}
          </button>
        </div>
      </dialog>
    </>
  );
}

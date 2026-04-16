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
    const trimmed = reason.trim();
    if (trimmed.length < 3) {
      toast.error("اكتب سبباً أوضح (3 أحرف على الأقل).");
      return;
    }
    setBusy(true);
    try {
      const res = await submitAttendanceCorrectionRequestFromReview({
        checkId,
        reason: trimmed,
        requestedStatus,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم إرسال الطلب للإدارة");
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
        className="w-full rounded border-2 border-amber-600 bg-amber-100 px-3 py-2 text-xs font-extrabold text-amber-950 shadow-sm md:w-auto"
        onClick={() => dlg.current?.showModal()}
      >
        طلب تعديل
      </button>
      <dialog
        ref={dlg}
        className="max-w-md rounded border-2 border-slate-500 bg-white p-4 text-right shadow-lg backdrop:bg-black/40"
      >
        <p className="text-base font-extrabold">طلب تعديل حضور</p>
        <p className="mt-1 text-xs text-slate-600">يُرسل للإدارة: السبب + الحالة المطلوبة (حاضر / غائب / نصف يوم).</p>
        <label className="mt-3 block text-xs font-bold">السبب</label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          className="mt-1 w-full resize-y border border-slate-400 px-2 py-1.5 text-sm"
          disabled={busy}
          placeholder="اكتب سبب الطلب…"
        />
        <label className="mt-3 block text-xs font-bold">الحالة المطلوبة</label>
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
            className="border border-slate-400 px-3 py-1.5 text-xs"
            disabled={busy}
            onClick={() => dlg.current?.close()}
          >
            إلغاء
          </button>
          <button
            type="button"
            className="bg-amber-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
            disabled={busy}
            onClick={() => void submit()}
          >
            {busy ? "…" : "إرسال للإدارة"}
          </button>
        </div>
      </dialog>
    </>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { resetAttendanceChecksForDateRound } from "@/app/(dashboard)/attendance/reset-actions";

export function AttendanceResetButton(props: { workDate: string; roundNo: number; siteId?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-xs font-extrabold text-red-900 transition hover:bg-red-100 disabled:opacity-50"
      onClick={async () => {
        if (!confirm("حذف جميع سجلات التحضير لهذا التاريخ والوردية (والموقع إن وُجد)؟ لا يمكن التراجع.")) {
          return;
        }
        setBusy(true);
        const fd = new FormData();
        fd.set("workDate", props.workDate);
        fd.set("roundNo", String(props.roundNo));
        if (props.siteId) fd.set("siteId", props.siteId);
        const res = await resetAttendanceChecksForDateRound(fd);
        setBusy(false);
        if (!res.ok) {
          toast.error("تعذّر التصفير");
          return;
        }
        toast.success("تم تصفير التحضير");
        router.refresh();
      }}
    >
      حذف كافة عمليات التحضير
    </button>
  );
}

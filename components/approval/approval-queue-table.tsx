"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Card } from "@/components/ui/card";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Decision = "confirm" | "reject";

type Props = {
  rows: AttendanceCheckRow[];
};

export function ApprovalQueueTable({ rows }: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCheckIds, setPendingCheckIds] = useState<number[]>([]);

  async function onDecision(checkId: number, decision: Decision) {
    if (isSaving) return;
    setIsSaving(true);
    setPendingCheckIds((prev) => Array.from(new Set([...prev, checkId])));
    try {
      const response = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "approval_decision",
          decision,
          checkIds: [checkId],
        }),
      });
      if (!response.ok) {
        throw new Error("save_failed");
      }
      router.refresh();
    } finally {
      setPendingCheckIds((prev) => prev.filter((id) => id !== checkId));
      setIsSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-right">العامل</th>
              <th className="px-3 py-2 text-right">الموقع</th>
              <th className="px-3 py-2 text-right">الجولة</th>
              <th className="px-3 py-2 text-right">الحالة</th>
              <th className="px-3 py-2 text-right">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPending = pendingCheckIds.includes(row.id);
              return (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">
                    <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                    <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                  </td>
                  <td className="px-3 py-2">{row.sites?.name ?? "-"}</td>
                  <td className="px-3 py-2">
                    {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                  </td>
                  <td className="px-3 py-2">
                    {row.status === "present" ? "حاضر" : row.status === "absent" ? "غائب" : "نصف يوم"}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onDecision(row.id, "confirm")}
                        className="rounded bg-emerald-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                        disabled={isPending || isSaving}
                      >
                        اعتماد
                      </button>
                      <button
                        type="button"
                        onClick={() => onDecision(row.id, "reject")}
                        className="rounded bg-red-700 px-3 py-1 text-xs font-bold text-white disabled:opacity-40"
                        disabled={isPending || isSaving}
                      >
                        رفض
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {rows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات اعتماد معلقة.</div>
      )}
    </Card>
  );
}

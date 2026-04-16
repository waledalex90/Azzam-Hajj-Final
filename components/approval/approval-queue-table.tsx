"use client";

import { useMemo, useState } from "react";
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
  const [selected, setSelected] = useState<Set<number>>(() => new Set());

  const rowIds = useMemo(() => rows.map((r) => r.id), [rows]);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.has(id));

  function toggleOne(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (allSelected) {
      setSelected(new Set());
      return;
    }
    setSelected(new Set(rowIds));
  }

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
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(checkId);
        return next;
      });
      router.refresh();
    } finally {
      setPendingCheckIds((prev) => prev.filter((id) => id !== checkId));
      setIsSaving(false);
    }
  }

  async function bulkFieldApprove() {
    const ids = Array.from(selected);
    if (ids.length === 0 || isSaving) return;
    setIsSaving(true);
    setPendingCheckIds(ids);
    try {
      const response = await fetch("/api/attendance/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "approval_decision",
          decision: "confirm",
          checkIds: ids,
        }),
      });
      if (!response.ok) throw new Error("save_failed");
      setSelected(new Set());
      router.refresh();
    } finally {
      setPendingCheckIds([]);
      setIsSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={isSaving || rows.length === 0}
            className="h-4 w-4 rounded border-slate-300"
          />
          تحديد الكل ({rows.length})
        </label>
        <button
          type="button"
          onClick={() => void bulkFieldApprove()}
          disabled={selected.size === 0 || isSaving}
          className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40"
        >
          اعتماد المحدد ({selected.size})
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="w-10 px-2 py-2 text-right font-bold"> </th>
              <th className="px-3 py-2 text-right font-bold">العامل</th>
              <th className="px-3 py-2 text-right font-bold">الموقع</th>
              <th className="px-3 py-2 text-right font-bold">الجولة</th>
              <th className="px-3 py-2 text-right font-bold">الحالة</th>
              <th className="px-3 py-2 text-right font-bold">الإجراء</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isPending = pendingCheckIds.includes(row.id);
              return (
                <tr key={row.id} className="border-t border-slate-200">
                  <td className="px-2 py-2">
                    <input
                      type="checkbox"
                      checked={selected.has(row.id)}
                      onChange={() => toggleOne(row.id)}
                      disabled={isSaving}
                      className="h-4 w-4 rounded border-slate-300"
                    />
                  </td>
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

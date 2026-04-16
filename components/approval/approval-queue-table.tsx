"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { approveAllPendingInFilter, approveChecksByIds } from "@/app/(dashboard)/approval/actions";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Decision = "confirm" | "reject";

type Props = {
  rows: AttendanceCheckRow[];
  /** إجمالي السجلات المعلّقة المطابقة للفلتر (قد يتجاوز 25) */
  totalPendingFiltered: number;
  workDate: string;
  siteId?: string;
  /** لاعتماد الجماعي «الكل» في السيرفر؛ البحث الفوري يكون على العميل */
  q?: string;
};

export function ApprovalQueueTable({
  rows,
  totalPendingFiltered,
  workDate,
  siteId,
  q,
}: Props) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCheckIds, setPendingCheckIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  /** إخفاء فوري بعد الاعتماد/الرفض حتى يصل التحديث من السيرفر */
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  /** عند وجود تحديد: الصفحة فقط، أو جميع المعلّقين ضمن الفلتر */
  const [bulkScope, setBulkScope] = useState<"page" | "all">("page");

  const displayRows = useMemo(
    () => rows.filter((r) => !removed.has(r.id)),
    [rows, removed],
  );

  const rowIds = useMemo(() => displayRows.map((r) => r.id), [displayRows]);
  const allSelected = rowIds.length > 0 && rowIds.every((id) => selected.has(id));
  const hasSelection = selected.size > 0;

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

  async function runBulkApprove() {
    if (isSaving) return;
    setIsSaving(true);
    try {
      if (bulkScope === "all") {
        const res = await approveAllPendingInFilter({
          workDate,
          siteId: siteId ? Number(siteId) : undefined,
          q,
        });
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        toast.success("تم الاعتماد ✅");
        setSelected(new Set());
        router.refresh();
        return;
      }
      const ids = Array.from(selected);
      if (ids.length === 0) {
        toast.error("حدد صفاً واحداً على الأقل.");
        return;
      }
      const res = await approveChecksByIds(ids);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("تم الاعتماد ✅");
      setSelected(new Set());
      setRemoved((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.add(id));
        return next;
      });
      router.refresh();
    } finally {
      setIsSaving(false);
    }
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
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        toast.error(
          response.status === 403
            ? "لا توجد صلاحية"
            : response.status === 401
              ? "يجب تسجيل الدخول"
              : payload.error || "فشل الاتصال بالخادم",
        );
        return;
      }
      toast.success(decision === "confirm" ? "تم الاعتماد ✅" : "تم الحفظ ✅");
      setRemoved((prev) => new Set(prev).add(checkId));
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

  return (
    <div className="overflow-hidden rounded border border-slate-300 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 bg-slate-50 px-3 py-2">
        <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-700">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleSelectAll}
            disabled={isSaving || displayRows.length === 0}
            className="h-4 w-4 rounded border-slate-300"
          />
          تحديد القائمة ({displayRows.length})
        </label>
        <button
          type="button"
          onClick={() => void runBulkApprove()}
          disabled={!hasSelection || isSaving}
          className="rounded-lg bg-[#166534] px-4 py-2 text-xs font-extrabold text-white disabled:opacity-40"
        >
          اعتماد المحدد
          {hasSelection ? (bulkScope === "all" ? ` (${totalPendingFiltered})` : ` (${selected.size})`) : ""}
        </button>
      </div>

      {hasSelection && (
        <div className="border-b border-amber-200 bg-amber-50/90 px-3 py-2 text-sm text-amber-950">
          <p className="mb-2 font-bold">نطاق الاعتماد</p>
          <div className="flex flex-wrap gap-3">
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="radio"
                name="approval-scope"
                checked={bulkScope === "page"}
                onChange={() => setBulkScope("page")}
                disabled={isSaving}
              />
              هذه الصفحة فقط (المحدد: {selected.size})
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="radio"
                name="approval-scope"
                checked={bulkScope === "all"}
                onChange={() => setBulkScope("all")}
                disabled={isSaving}
              />
              كافة المعلّقين المطابقين للفلتر ({totalPendingFiltered})
            </label>
          </div>
        </div>
      )}

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
            {displayRows.map((row) => {
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

      {displayRows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات اعتماد معلقة.</div>
      )}
    </div>
  );
}

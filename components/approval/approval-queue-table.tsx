"use client";

import { useMemo, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TableVirtuoso } from "react-virtuoso";

import { approveApprovalChunk, fetchPendingApprovalIds } from "@/app/(dashboard)/approval/actions";
import { CorrectionRequestDialog } from "@/components/attendance/correction-request-dialog";
import { useRunWithGlobalLock } from "@/components/providers/global-action-lock-context";
import type { AttendanceCheckRow } from "@/lib/types/db";

type Decision = "confirm" | "reject";

type Props = {
  rows: AttendanceCheckRow[];
  totalPendingFiltered: number;
  workDate: string;
  siteId?: string;
  contractorId?: string;
  roundNo: number;
  canCorrection: boolean;
  onChunkApproved: (checkIds: number[]) => void;
};

const TABLE_H = "min(70vh,900px)";
const CLIENT_APPROVAL_CHUNK = 500;

function chunkIds(ids: number[], size: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < ids.length; i += size) {
    out.push(ids.slice(i, i + size));
  }
  return out;
}

export function ApprovalQueueTable({
  rows,
  totalPendingFiltered,
  workDate,
  siteId,
  contractorId,
  roundNo,
  canCorrection,
  onChunkApproved,
}: Props) {
  const router = useRouter();
  const runLocked = useRunWithGlobalLock();
  const [isSaving, setIsSaving] = useState(false);
  const [pendingCheckIds, setPendingCheckIds] = useState<number[]>([]);
  const [selected, setSelected] = useState<Set<number>>(() => new Set());
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
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
    await runLocked(async () => {
      setIsSaving(true);
      try {
        if (bulkScope === "all") {
        const listed = await fetchPendingApprovalIds({
          workDate,
          siteId: siteId ? Number(siteId) : undefined,
          contractorId: contractorId ? Number(contractorId) : undefined,
          roundNo,
        });
        if (!listed.ok) {
          toast.error(listed.error);
          return;
        }
        const allIds = listed.ids;
        if (allIds.length === 0) {
          toast.error("لا توجد سجلات معلّقة ضمن الفلتر.");
          return;
        }
        const chunks = chunkIds(allIds, CLIENT_APPROVAL_CHUNK);
        const progressId = toast.loading(`جاري الاعتماد… دفعة 1 من ${chunks.length}`);
        for (let i = 0; i < chunks.length; i += 1) {
          toast.loading(`جاري الاعتماد… دفعة ${i + 1} من ${chunks.length}`, { id: progressId });
          const res = await approveApprovalChunk(chunks[i]);
          if (!res.ok) {
            toast.error(res.error, { id: progressId });
            void router.refresh();
            return;
          }
          flushSync(() => {
            onChunkApproved(chunks[i]);
          });
          void router.refresh();
        }
        toast.success(
          chunks.length > 1
            ? `تم الاعتماد — ${chunks.length} دفعة (${allIds.length} سجل)`
            : "تم الاعتماد ✅",
          { id: progressId },
        );
        setSelected(new Set());
        setRemoved(new Set());
        void router.refresh();
        return;
      }

      const ids = Array.from(selected);
      if (ids.length === 0) {
        toast.error("حدد صفاً واحداً على الأقل.");
        return;
      }
      flushSync(() => {
        setRemoved((prev) => {
          const next = new Set(prev);
          ids.forEach((id) => next.add(id));
          return next;
        });
      });
      const chunks = chunkIds(ids, CLIENT_APPROVAL_CHUNK);
      const progressId = toast.loading(`جاري الاعتماد… دفعة 1 من ${chunks.length}`);
      for (let i = 0; i < chunks.length; i += 1) {
        toast.loading(`جاري الاعتماد… دفعة ${i + 1} من ${chunks.length}`, { id: progressId });
        const res = await approveApprovalChunk(chunks[i]);
        if (!res.ok) {
          toast.error(res.error, { id: progressId });
          flushSync(() => setRemoved(new Set()));
          void router.refresh();
          return;
        }
        flushSync(() => {
          onChunkApproved(chunks[i]);
        });
        void router.refresh();
      }
      toast.success(
        chunks.length > 1
          ? `تم الاعتماد — ${chunks.length} دفعة (${ids.length} سجل)`
          : "تم الاعتماد ✅",
        { id: progressId },
      );
      setSelected(new Set());
      setRemoved(new Set());
      void router.refresh();
      } finally {
        setIsSaving(false);
      }
    });
  }

  async function onDecision(checkId: number, decision: Decision) {
    if (isSaving) return;
    await runLocked(async () => {
      setIsSaving(true);
      setPendingCheckIds((prev) => Array.from(new Set([...prev, checkId])));
      setRemoved((prev) => new Set(prev).add(checkId));
      try {
        const response = await fetch("/api/attendance/sync", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "approval_decision",
          decision,
          checkIds: [checkId],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        code?: string;
      };
      if (!response.ok) {
        setRemoved((prev) => {
          const next = new Set(prev);
          next.delete(checkId);
          return next;
        });
        const detail = [payload.code, payload.error].filter(Boolean).join(" — ");
        toast.error(
          response.status === 403
            ? "لا توجد صلاحية"
            : response.status === 401
              ? "يجب تسجيل الدخول"
              : detail || `فشل الاتصال (${response.status})`,
        );
        void router.refresh();
        return;
      }
      toast.success(decision === "confirm" ? "تم الاعتماد ✅" : "تم الحفظ ✅");
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(checkId);
        return next;
      });
      if (decision === "confirm") {
        flushSync(() => {
          onChunkApproved([checkId]);
        });
      }
      void router.refresh();
      } finally {
        setPendingCheckIds((prev) => prev.filter((id) => id !== checkId));
        setIsSaving(false);
      }
    });
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
            className="h-4 w-4"
          />
          تحديد المعروض ({displayRows.length})
        </label>
        <button
          type="button"
          onClick={() => void runBulkApprove()}
          disabled={!hasSelection || isSaving}
          className="rounded border border-emerald-800 bg-[#166534] px-4 py-2 text-xs font-bold text-white disabled:opacity-40"
        >
          اعتماد المحدد
          {hasSelection ? (bulkScope === "all" ? ` (${totalPendingFiltered})` : ` (${selected.size})`) : ""}
        </button>
      </div>

      {hasSelection && (
        <div className="border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
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
              المعروض في الجدول (المحدد: {selected.size})
            </label>
            <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-bold">
              <input
                type="radio"
                name="approval-scope"
                checked={bulkScope === "all"}
                onChange={() => setBulkScope("all")}
                disabled={isSaving}
              />
              كل المعلّقين في الفلتر ({totalPendingFiltered})
            </label>
          </div>
        </div>
      )}

      <div style={{ height: TABLE_H }}>
        <TableVirtuoso
          data={displayRows}
          fixedItemHeight={52}
          style={{ height: "100%" }}
          components={{
            Table: ({ style, ...props }) => (
              <table
                {...props}
                style={{ ...style, width: "100%", borderCollapse: "collapse" }}
                className="text-sm"
              />
            ),
          }}
          fixedHeaderContent={() => (
            <tr className="bg-slate-100">
              <th className="w-10 border border-slate-300 px-2 py-2 text-right font-bold"> </th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">العامل</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الموقع</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">المقاول</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الجولة</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">الحالة</th>
              <th className="border border-slate-300 px-3 py-2 text-right font-bold">إجراء</th>
            </tr>
          )}
          itemContent={(_index, row) => {
            const isPending = pendingCheckIds.includes(row.id);
            return (
              <>
                <td className="border border-slate-300 px-2 py-1">
                  <input
                    type="checkbox"
                    checked={selected.has(row.id)}
                    onChange={() => toggleOne(row.id)}
                    disabled={isSaving}
                    className="h-4 w-4"
                  />
                </td>
                <td className="border border-slate-300 px-3 py-1 align-top">
                  <p className="font-bold text-slate-800">{row.workers?.name ?? "-"}</p>
                  <p className="text-xs text-slate-500">{row.workers?.id_number ?? "-"}</p>
                </td>
                <td className="border border-slate-300 px-3 py-1">{row.sites?.name ?? "—"}</td>
                <td className="border border-slate-300 px-3 py-1">{row.contractors?.name ?? "—"}</td>
                <td className="border border-slate-300 px-3 py-1 text-xs">
                  {row.attendance_rounds?.work_date ?? "-"} / #{row.attendance_rounds?.round_no ?? "-"}
                </td>
                <td className="border border-slate-300 px-3 py-1">
                  {row.status === "present" ? "حاضر" : row.status === "absent" ? "غائب" : "—"}
                </td>
                <td className="border border-slate-300 px-3 py-1 align-top">
                  <div className="flex flex-col gap-1 sm:flex-row sm:flex-wrap sm:items-start">
                    <div className="flex flex-wrap gap-1">
                      <button
                        type="button"
                        onClick={() => void onDecision(row.id, "confirm")}
                        className="rounded border border-emerald-800 bg-emerald-700 px-2 py-0.5 text-xs font-bold text-white disabled:opacity-40"
                        disabled={isPending || isSaving}
                      >
                        اعتماد
                      </button>
                      <button
                        type="button"
                        onClick={() => void onDecision(row.id, "reject")}
                        className="rounded border border-red-800 bg-red-700 px-2 py-0.5 text-xs font-bold text-white disabled:opacity-40"
                        disabled={isPending || isSaving}
                      >
                        رفض
                      </button>
                    </div>
                    <CorrectionRequestDialog checkId={row.id} disabled={!canCorrection} />
                  </div>
                </td>
              </>
            );
          }}
        />
      </div>

      {displayRows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات اعتماد معلقة.</div>
      )}
    </div>
  );
}

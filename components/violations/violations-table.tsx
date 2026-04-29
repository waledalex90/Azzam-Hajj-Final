"use client";

import { useFormStatus } from "react-dom";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ViolationRow } from "@/lib/types/db";
import { approveWorkerViolationAction, rejectWorkerViolationAction } from "@/app/(dashboard)/violations/actions";

type Props = {
  rows: ViolationRow[];
  /** اعتماد/رفض وخصومات — بدون هذه الصلاحية عرض القائمة فقط */
  allowManageViolationActions?: boolean;
};

function getStatusLabel(status: ViolationRow["status"]) {
  switch (status) {
    case "pending_review":
      return "بانتظار المراجعة";
    case "needs_more_info":
      return "مطلوب معلومات";
    case "approved":
      return "معتمد";
    case "rejected":
      return "مرفوض";
    default:
      return status;
  }
}

function canReview(status: ViolationRow["status"]) {
  return status === "pending_review" || status === "needs_more_info";
}

function SubmitRowButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="primary" className="min-h-9 px-3 py-1.5 text-sm" disabled={pending}>
      {pending ? "…" : label}
    </Button>
  );
}

function ReviewCell({
  v,
  allowManage,
}: {
  v: ViolationRow;
  allowManage: boolean;
}) {
  const defaultDed = Number(v.deduction_sar ?? 0);
  if (!canReview(v.status)) {
    return (
      <span className="text-slate-600">
        {v.status === "approved" ? `${defaultDed.toFixed(2)} (معتمد)` : "—"}
      </span>
    );
  }

  if (!allowManage) {
    return <span className="text-xs font-bold text-slate-500">عرض القائمة فقط — تتطلّب الاعتماد صلاحية إدارة.</span>;
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <form action={approveWorkerViolationAction} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="violationId" value={v.id} />
        <label className="text-xs font-bold text-slate-700">
          خصم المقاول (ر.س)
          <Input
            name="deduction_sar"
            type="number"
            step="0.01"
            min="0"
            defaultValue={Number.isFinite(defaultDed) ? defaultDed.toFixed(2) : "0"}
            className="mt-0.5 w-28"
            required
          />
        </label>
        <SubmitRowButton label="اعتماد" />
      </form>
      <form action={rejectWorkerViolationAction}>
        <input type="hidden" name="violationId" value={v.id} />
        <Button type="submit" variant="danger" className="min-h-9 px-3 py-1.5 text-sm">
          رفض
        </Button>
      </form>
    </div>
  );
}

export function ViolationsTable({ rows, allowManageViolationActions = true }: Props) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="space-y-3 p-3 md:hidden">
        {rows.map((violation) => (
          <div key={violation.id} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className="font-bold text-slate-800">{violation.workers?.name ?? "غير معروف"}</p>
            <p className="text-xs text-slate-500">{violation.workers?.id_number ?? "-"}</p>
            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p>الموقع: {violation.sites?.name ?? "غير محدد"}</p>
              <p>المخالفة: {violation.violation_types?.name_ar ?? "-"}</p>
              <p>الحالة: {getStatusLabel(violation.status)}</p>
              <p>التاريخ: {new Date(violation.occurred_at).toLocaleDateString("ar-SA")}</p>
            </div>
            <div className="mt-3 border-t border-slate-100 pt-2">
              <p className="mb-1 text-xs font-bold text-slate-800">اعتماد وخصم المقاول</p>
              <ReviewCell v={violation} allowManage={allowManageViolationActions} />
            </div>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-slate-700">
            <tr>
              <th className="px-3 py-2 text-right font-bold">العامل</th>
              <th className="px-3 py-2 text-right font-bold">الموقع</th>
              <th className="px-3 py-2 text-right font-bold">نوع المخالفة</th>
              <th className="px-3 py-2 text-right font-bold">خصم الاعتماد (ر.س)</th>
              <th className="px-3 py-2 text-right font-bold">الحالة</th>
              <th className="px-3 py-2 text-right font-bold">التاريخ</th>
              <th className="min-w-[200px] px-3 py-2 text-right font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((violation) => (
              <tr key={violation.id} className="border-t border-slate-200">
                <td className="px-3 py-2 align-top">
                  <p className="font-bold text-slate-800">{violation.workers?.name ?? "غير معروف"}</p>
                  <p className="text-xs text-slate-500">{violation.workers?.id_number ?? "-"}</p>
                </td>
                <td className="px-3 py-2 align-top">{violation.sites?.name ?? "غير محدد"}</td>
                <td className="px-3 py-2 align-top">{violation.violation_types?.name_ar ?? "-"}</td>
                <td className="px-3 py-2 align-top">
                  {canReview(violation.status) ? (
                    <span className="text-xs text-slate-500">يُحدَّد عند الاعتماد</span>
                  ) : (
                    <span>{Number(violation.deduction_sar ?? 0).toFixed(2)}</span>
                  )}
                </td>
                <td className="px-3 py-2 align-top">{getStatusLabel(violation.status)}</td>
                <td className="px-3 py-2 align-top whitespace-nowrap">
                  {new Date(violation.occurred_at).toLocaleDateString("ar-SA")}
                </td>
                <td className="px-3 py-2 align-top">
                  <ReviewCell v={violation} allowManage={allowManageViolationActions} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && (
        <div className="p-4 text-center text-sm text-slate-500">لا توجد مخالفات مطابقة للفلاتر الحالية.</div>
      )}
    </Card>
  );
}

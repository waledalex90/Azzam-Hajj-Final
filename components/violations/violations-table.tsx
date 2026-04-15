import { Card } from "@/components/ui/card";
import type { ViolationRow } from "@/lib/types/db";

type Props = {
  rows: ViolationRow[];
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

export function ViolationsTable({ rows }: Props) {
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
              <th className="px-3 py-2 text-right font-bold">الحالة</th>
              <th className="px-3 py-2 text-right font-bold">التاريخ</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((violation) => (
              <tr key={violation.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <p className="font-bold text-slate-800">{violation.workers?.name ?? "غير معروف"}</p>
                  <p className="text-xs text-slate-500">{violation.workers?.id_number ?? "-"}</p>
                </td>
                <td className="px-3 py-2">{violation.sites?.name ?? "غير محدد"}</td>
                <td className="px-3 py-2">{violation.violation_types?.name_ar ?? "-"}</td>
                <td className="px-3 py-2">{getStatusLabel(violation.status)}</td>
                <td className="px-3 py-2">{new Date(violation.occurred_at).toLocaleDateString("ar-SA")}</td>
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

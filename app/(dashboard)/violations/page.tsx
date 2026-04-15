import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ViolationsTable } from "@/components/violations/violations-table";
import { getViolationsPage } from "@/lib/data/violations";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    status?: "pending_review" | "needs_more_info" | "approved" | "rejected";
    siteId?: string;
  }>;
};

const PAGE_SIZE = 20;

export default async function ViolationsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const status = params.status;

  const { rows, meta } = await getViolationsPage({
    page,
    pageSize: PAGE_SIZE,
    siteId: Number.isFinite(siteId) ? siteId : undefined,
    status,
  });

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">شاشة المخالفات</h1>
        <p className="mt-1 text-sm text-slate-600">
          جلب البيانات يتم من السيرفر مع Pagination ودعم فلاتر الحالة والموقع.
        </p>
        <form className="mt-4 grid gap-2 sm:grid-cols-3" method="get">
          <select
            name="status"
            defaultValue={status}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">كل الحالات</option>
            <option value="pending_review">بانتظار المراجعة</option>
            <option value="needs_more_info">مطلوب معلومات</option>
            <option value="approved">معتمد</option>
            <option value="rejected">مرفوض</option>
          </select>
          <Input name="siteId" defaultValue={params.siteId} placeholder="رقم الموقع (اختياري)" />
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800"
          >
            تطبيق الفلاتر
          </button>
        </form>
      </Card>

      <ViolationsTable rows={rows} />

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/violations"
        query={{ status, siteId: params.siteId }}
      />
    </section>
  );
}

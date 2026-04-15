import { AttendanceWorkersTable } from "@/components/attendance/attendance-workers-table";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getAttendanceWorkersPage } from "@/lib/data/attendance";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    q?: string;
    siteId?: string;
  }>;
};

const PAGE_SIZE = 25;

export default async function AttendancePage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const q = params.q?.trim();

  const { rows, meta } = await getAttendanceWorkersPage({
    page,
    pageSize: PAGE_SIZE,
    siteId: Number.isFinite(siteId) ? siteId : undefined,
    search: q,
  });

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">شاشة التحضير - مراقب فني</h1>
        <p className="mt-1 text-sm text-slate-600">
          عرض العمال عبر Server-side Pagination لتقليل الضغط عند 6000 عامل.
        </p>

        <form className="mt-4 grid gap-2 sm:grid-cols-3" method="get">
          <Input name="q" defaultValue={q} placeholder="بحث بالاسم أو رقم الهوية" />
          <Input name="siteId" defaultValue={params.siteId} placeholder="رقم الموقع (اختياري)" />
          <button
            type="submit"
            className="rounded-lg bg-teal-700 px-3 py-2 text-sm font-bold text-white hover:bg-teal-800"
          >
            تطبيق الفلاتر
          </button>
        </form>
      </Card>

      <AttendanceWorkersTable rows={rows} />

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/attendance"
        query={{ q, siteId: params.siteId }}
      />
    </section>
  );
}

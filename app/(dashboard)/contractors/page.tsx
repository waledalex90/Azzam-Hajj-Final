import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationControls } from "@/components/pagination/pagination-controls";
import { getContractorFinanceData } from "@/lib/data/contractors";
import { parsePage } from "@/lib/utils/pagination";

type Props = {
  searchParams: Promise<{
    page?: string;
    start?: string;
    end?: string;
    siteId?: string;
    contractorId?: string;
  }>;
};

const PAGE_SIZE = 12;

function defaultStartDate() {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().slice(0, 10);
}

function defaultEndDate() {
  return new Date().toISOString().slice(0, 10);
}

export default async function ContractorsPage({ searchParams }: Props) {
  const params = await searchParams;
  const page = parsePage(params.page, 1);
  const startDate = params.start && /^\d{4}-\d{2}-\d{2}$/.test(params.start) ? params.start : defaultStartDate();
  const endDate = params.end && /^\d{4}-\d{2}-\d{2}$/.test(params.end) ? params.end : defaultEndDate();
  const siteId = params.siteId ? Number(params.siteId) : undefined;
  const contractorId = params.contractorId ? Number(params.contractorId) : undefined;

  const { rows, meta, sites, contractors } = await getContractorFinanceData({
    startDate,
    endDate,
    siteId: Number.isFinite(siteId) ? siteId : undefined,
    contractorId: Number.isFinite(contractorId) ? contractorId : undefined,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-xl font-extrabold text-slate-900">المقاولين - المستخلص المالي</h1>
        <p className="mt-1 text-sm text-slate-600">
          منطق النسخة القديمة: احتساب الأيام = (حاضر + نصف يوم × 0.5) والقيمة = الأيام × 100.
        </p>
        <form method="get" className="mt-4 grid gap-2 sm:grid-cols-5">
          <Input name="start" type="date" defaultValue={startDate} />
          <Input name="end" type="date" defaultValue={endDate} />
          <select
            name="siteId"
            defaultValue={params.siteId}
            className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
          >
            <option value="">كل المواقع</option>
            {sites.map((site) => (
              <option key={site.id} value={site.id}>
                {site.name}
              </option>
            ))}
          </select>
          <select
            name="contractorId"
            defaultValue={params.contractorId}
            className="min-h-12 w-full rounded-lg border border-[#d8c99a] bg-white px-4 py-3 text-base"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <Button type="submit">تحديث التقرير</Button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="px-3 py-2 text-right font-bold">المقاول</th>
                <th className="px-3 py-2 text-right font-bold">الموقع</th>
                <th className="px-3 py-2 text-right font-bold">عدد العمال</th>
                <th className="px-3 py-2 text-right font-bold">عدد الأيام</th>
                <th className="px-3 py-2 text-right font-bold">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.contractorId}-${row.siteId}-${index}`} className="border-t border-slate-200">
                  <td className="px-3 py-2 font-bold text-slate-800">{row.contractor}</td>
                  <td className="px-3 py-2">{row.site}</td>
                  <td className="px-3 py-2">{row.workers}</td>
                  <td className="px-3 py-2">{row.days}</td>
                  <td className="px-3 py-2 font-bold text-emerald-700">{row.amount.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات ضمن الفلاتر الحالية.</div>
        )}
      </Card>

      <PaginationControls
        page={meta.page}
        totalPages={meta.totalPages}
        basePath="/contractors"
        query={{ start: startDate, end: endDate, siteId: params.siteId, contractorId: params.contractorId }}
      />
    </section>
  );
}

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getContractorOptions, getSiteOptions } from "@/lib/data/attendance";

type Props = {
  searchParams: Promise<{
    month?: string;
    year?: string;
    siteId?: string;
    contractorId?: string;
  }>;
};

type MatrixRow = {
  worker_id: number;
  worker_name: string;
  id_number: string;
  day: string;
  status: "present" | "absent" | "half" | null;
};

export default async function ReportsPage({ searchParams }: Props) {
  const params = await searchParams;
  const now = new Date();
  const monthNum = Math.max(1, Math.min(12, Number(params.month) || now.getMonth() + 1));
  const yearNum = Math.max(2024, Number(params.year) || now.getFullYear());
  const siteId = params.siteId ? Number(params.siteId) : null;
  const contractorId = params.contractorId ? Number(params.contractorId) : null;

  const [sites, contractors] = await Promise.all([getSiteOptions(), getContractorOptions()]);
  const supabase = createSupabaseAdminClient();

  const { data } = await supabase.rpc("get_monthly_attendance_matrix", {
    p_year: yearNum,
    p_month: monthNum,
    p_site_id: siteId,
    p_contractor_id: contractorId,
  });

  const rows = ((data as MatrixRow[] | null) ?? []).slice(0, 200);
  const grouped = new Map<
    number,
    {
      worker_name: string;
      id_number: string;
      byDay: Record<string, string>;
    }
  >();

  for (const row of rows) {
    if (!grouped.has(row.worker_id)) {
      grouped.set(row.worker_id, { worker_name: row.worker_name, id_number: row.id_number, byDay: {} });
    }
    grouped.get(row.worker_id)!.byDay[row.day] =
      row.status === "present" ? "ح" : row.status === "absent" ? "غ" : row.status === "half" ? "ن" : "-";
  }

  const previewRows = Array.from(grouped.values()).slice(0, 20);
  const previewDays = Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(2, "0"));

  return (
    <section className="space-y-4">
      <Card>
        <h1 className="text-lg font-extrabold text-slate-900">التقارير</h1>
        <form className="mt-4 grid gap-2 sm:grid-cols-5" method="get">
          <Input name="month" type="number" min={1} max={12} defaultValue={String(monthNum)} placeholder="الشهر" />
          <Input name="year" type="number" min={2024} defaultValue={String(yearNum)} placeholder="السنة" />
          <select
            name="siteId"
            defaultValue={params.siteId}
            className="min-h-12 rounded-lg border border-[#d8c99a] bg-white px-4 py-3"
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
            className="min-h-12 rounded-lg border border-[#d8c99a] bg-white px-4 py-3"
          >
            <option value="">كل المقاولين</option>
            {contractors.map((contractor) => (
              <option key={contractor.id} value={contractor.id}>
                {contractor.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-bold text-white">استخراج التقرير</button>
        </form>
      </Card>

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead className="bg-slate-100">
              <tr>
                <th className="px-2 py-2 text-right">العامل</th>
                {previewDays.map((day) => (
                  <th key={day} className="px-2 py-2 text-center">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.map((row) => (
                <tr key={`${row.id_number}-${row.worker_name}`} className="border-t border-slate-200">
                  <td className="px-2 py-2 text-right">
                    <p className="font-bold text-slate-800">{row.worker_name}</p>
                    <p className="text-[10px] text-slate-500">{row.id_number}</p>
                  </td>
                  {previewDays.map((day) => (
                    <td key={day} className="px-2 py-2 text-center">
                      {row.byDay[day] ?? "-"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {previewRows.length === 0 && (
          <div className="p-4 text-center text-sm text-slate-500">لا توجد بيانات للتقرير المحدد.</div>
        )}
      </Card>
    </section>
  );
}

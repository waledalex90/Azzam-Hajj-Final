import { unstable_noStore as noStore } from "next/cache";

import { Card } from "@/components/ui/card";
import { ReportsHubNav } from "@/components/reports/reports-hub-nav";
import {
  buildNavHrefs,
  ContractorsReportSection,
  MonthlyReportSection,
  PayrollReportSection,
  RangeReportSection,
  WorkersDataReportSection,
} from "@/components/reports/report-sections";

type Props = {
  searchParams: Promise<{
    tab?: string;
    month?: string;
    year?: string;
    siteId?: string;
    contractorId?: string;
    shift?: string;
    from?: string;
    to?: string;
    rangeShift?: string;
  }>;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const maxDuration = 120;

const VALID_TABS = new Set(["monthly", "range", "contractors", "payroll", "workers"]);

export default async function ReportsPage({ searchParams }: Props) {
  noStore();
  const sp = await searchParams;
  const tab = VALID_TABS.has(String(sp.tab)) ? String(sp.tab) : "monthly";
  const hrefs = buildNavHrefs(sp);

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <h1 className="text-xl font-extrabold text-slate-900">التقارير</h1>
        <p className="text-xs text-slate-500">الرئيسية / التقارير</p>
        <ReportsHubNav active={tab} hrefs={hrefs} />
      </Card>

      {tab === "monthly" ? <MonthlyReportSection sp={sp} /> : null}
      {tab === "range" ? <RangeReportSection sp={sp} /> : null}
      {tab === "contractors" ? <ContractorsReportSection sp={sp} /> : null}
      {tab === "payroll" ? <PayrollReportSection sp={sp} /> : null}
      {tab === "workers" ? <WorkersDataReportSection /> : null}
    </section>
  );
}

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { ContractorOption, SiteOption } from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";

type Params = {
  startDate: string;
  endDate: string;
  siteId?: number;
  contractorId?: number;
  page: number;
  pageSize: number;
};

type AggregatedRow = {
  contractorId: number | null;
  contractor: string;
  siteId: number | null;
  site: string;
  workers: number;
  days: number;
  amount: number;
};

type RawSummary = {
  worker_id: number;
  final_status: "present" | "absent" | "half" | null;
  workers?:
    | {
    contractor_id: number | null;
    current_site_id: number | null;
    contractors?: { name: string } | { name: string }[] | null;
    sites?: { name: string } | { name: string }[] | null;
      }
    | {
        contractor_id: number | null;
        current_site_id: number | null;
        contractors?: { name: string }[] | null;
        sites?: { name: string }[] | null;
      }[]
    | null;
};

const INVOICE_RATE = 100;

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

export async function getContractorFinanceData({
  startDate,
  endDate,
  siteId,
  contractorId,
  page,
  pageSize,
}: Params): Promise<{
  rows: AggregatedRow[];
  meta: ReturnType<typeof buildPaginationMeta>;
  sites: SiteOption[];
  contractors: ContractorOption[];
}> {
  const supabase = createSupabaseAdminClient();

  const [{ data: sites }, { data: contractors }] = await Promise.all([
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("contractors").select("id, name").order("name"),
  ]);

  let allRows: RawSummary[] = [];
  let from = 0;
  const chunk = 2000;
  while (true) {
    let q = supabase
      .from("attendance_daily_summary")
      .select(
        "worker_id, final_status, workers!inner(contractor_id,current_site_id,contractors(name),sites(name))",
      )
      .gte("work_date", startDate)
      .lte("work_date", endDate)
      .order("worker_id", { ascending: true })
      .range(from, from + chunk - 1);

    if (siteId) q = q.eq("site_id", siteId);
    if (contractorId) q = q.eq("workers.contractor_id", contractorId);

    const { data, error } = await q;
    if (error) throw new Error(`Contractor finance query failed: ${error.message}`);
    const rows = (data as RawSummary[]) ?? [];
    allRows = allRows.concat(rows);
    if (rows.length < chunk) break;
    from += chunk;
  }

  const grouped = new Map<string, { info: Omit<AggregatedRow, "workers" | "days" | "amount">; workerSet: Set<number>; days: number }>();

  for (const row of allRows) {
    const worker = firstRelation(row.workers);
    const cId = worker?.contractor_id ?? null;
    const sId = worker?.current_site_id ?? null;
    const contractorName = firstRelation(worker?.contractors)?.name ?? "غير محدد";
    const siteName = firstRelation(worker?.sites)?.name ?? "عام";
    const key = `${cId ?? "n"}_${sId ?? "n"}`;
    if (!grouped.has(key)) {
      grouped.set(key, {
        info: {
          contractorId: cId,
          contractor: contractorName,
          siteId: sId,
          site: siteName,
        },
        workerSet: new Set<number>(),
        days: 0,
      });
    }
    const bucket = grouped.get(key)!;
    bucket.workerSet.add(row.worker_id);
    if (row.final_status === "present") bucket.days += 1;
    else if (row.final_status === "half") bucket.days += 0.5;
  }

  const aggregated: AggregatedRow[] = Array.from(grouped.values())
    .map((entry) => ({
      ...entry.info,
      workers: entry.workerSet.size,
      days: Number(entry.days.toFixed(2)),
      amount: Number((entry.days * INVOICE_RATE).toFixed(2)),
    }))
    .sort((a, b) => b.amount - a.amount);

  const totalRows = aggregated.length;
  const start = (page - 1) * pageSize;
  const pagedRows = aggregated.slice(start, start + pageSize);

  return {
    rows: pagedRows,
    meta: buildPaginationMeta(totalRows, page, pageSize),
    sites: (sites as SiteOption[]) ?? [],
    contractors: (contractors as ContractorOption[]) ?? [],
  };
}

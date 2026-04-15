import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  ContractorOption,
  PaginationMeta,
  SiteOption,
  ViolationRow,
  ViolationTypeOption,
  WorkerRow,
} from "@/lib/types/db";
import { buildPaginationMeta } from "@/lib/utils/pagination";

type ViolationsPageParams = {
  page: number;
  pageSize: number;
  siteId?: number;
  status?: "pending_review" | "needs_more_info" | "approved" | "rejected";
};

type RawViolationRow = Omit<ViolationRow, "workers" | "sites" | "violation_types"> & {
  workers?: { name: string; id_number: string } | { name: string; id_number: string }[] | null;
  sites?: { name: string } | { name: string }[] | null;
  violation_types?: { name_ar: string } | { name_ar: string }[] | null;
};

const NOTICE_VIOLATION_TYPES = [
  { code: "worker_absence", name_ar: "غياب عامل / عاملية النظافة", severity: "high" },
  { code: "no_replacement", name_ar: "عدم توفير عامل بديل", severity: "high" },
  { code: "work_negligence", name_ar: "التقصير في الأعمال (عدم نظافة المجمع)", severity: "high" },
  { code: "uniform_noncompliance", name_ar: "عدم الالتزام بالزي الرسمي", severity: "medium" },
  { code: "no_work_card", name_ar: "عدم حمل بطاقة العمل", severity: "medium" },
  { code: "public_etiquette", name_ar: "عدم الالتزام بالآداب العامة", severity: "medium" },
  { code: "bad_behavior", name_ar: "سوء السلوك مع الحجيج", severity: "high" },
  { code: "no_accommodation", name_ar: "عدم توفير إعاشة", severity: "high" },
  { code: "other_notice", name_ar: "أخرى", severity: "low" },
] as const;

export async function getViolationsPage({
  page,
  pageSize,
  siteId,
  status,
}: ViolationsPageParams): Promise<{ rows: ViolationRow[]; meta: PaginationMeta }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const supabase = createSupabaseAdminClient();

  let query = supabase
    .from("worker_violations")
    .select(
      "id, worker_id, site_id, description, status, occurred_at, workers(name,id_number), sites(name), violation_types(name_ar)",
      { count: "planned" },
    )
    .order("occurred_at", { ascending: false });

  if (siteId) {
    query = query.eq("site_id", siteId);
  }

  if (status) {
    query = query.eq("status", status);
  }

  const { data, count, error } = await query.range(from, to);
  if (error) {
    throw new Error(`Violations query failed: ${error.message}`);
  }

  const totalRows = count ?? 0;
  const rows: ViolationRow[] =
    ((data as RawViolationRow[]) ?? []).map((item) => ({
      ...item,
      workers: Array.isArray(item.workers) ? (item.workers[0] ?? null) : (item.workers ?? null),
      sites: Array.isArray(item.sites) ? (item.sites[0] ?? null) : (item.sites ?? null),
      violation_types: Array.isArray(item.violation_types)
        ? (item.violation_types[0] ?? null)
        : (item.violation_types ?? null),
    })) ?? [];

  return {
    rows,
    meta: buildPaginationMeta(totalRows, page, pageSize),
  };
}

export async function getViolationFormOptions(search?: string): Promise<{
  sites: SiteOption[];
  violationTypes: ViolationTypeOption[];
  workers: WorkerRow[];
}> {
  const supabase = createSupabaseAdminClient();

  const [{ data: sites, error: siteError }, { data: types, error: typeError }] = await Promise.all([
    supabase.from("sites").select("id, name").order("name"),
    supabase.from("violation_types").select("id, name_ar").eq("is_active", true).order("id"),
  ]);

  if (siteError) throw new Error(`Sites query failed: ${siteError.message}`);
  if (typeError) throw new Error(`Violation types query failed: ${typeError.message}`);

  let workersQuery = supabase
    .from("workers")
    .select("id, name, id_number, contractor_id, current_site_id, is_active, is_deleted")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("id", { ascending: false })
    .limit(30);

  if (search && search.trim()) {
    const value = search.trim();
    workersQuery = workersQuery.or(`name.ilike.%${value}%,id_number.ilike.%${value}%`);
  }

  const { data: workers, error: workerError } = await workersQuery;
  if (workerError) throw new Error(`Workers query failed: ${workerError.message}`);

  return {
    sites: (sites as SiteOption[]) ?? [],
    violationTypes: (types as ViolationTypeOption[]) ?? [],
    workers: (workers as WorkerRow[]) ?? [],
  };
}

async function ensureNoticeViolationTypes(): Promise<ViolationTypeOption[]> {
  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.from("violation_types").upsert(
    NOTICE_VIOLATION_TYPES.map((item) => ({
      code: item.code,
      name_ar: item.name_ar,
      severity: item.severity,
      is_active: true,
    })),
    { onConflict: "code" },
  );
  if (error) throw new Error(`Ensure notice violation types failed: ${error.message}`);

  const { data, error: qError } = await supabase
    .from("violation_types")
    .select("id, name_ar")
    .in(
      "code",
      NOTICE_VIOLATION_TYPES.map((item) => item.code),
    )
    .order("id");
  if (qError) throw new Error(`Notice violation types query failed: ${qError.message}`);
  return (data as ViolationTypeOption[]) ?? [];
}

function mapSiteByKeyword(sites: SiteOption[]) {
  const getId = (keywords: string[]) => {
    const found = sites.find((site) => keywords.some((k) => site.name.includes(k)));
    return found?.id ?? null;
  };
  return {
    minaSiteId: getId(["منى", "مِنى"]),
    arafatSiteId: getId(["عرفات"]),
    muzdalifahSiteId: getId(["مزدلفة"]),
  };
}

export async function getInfractionNoticeOptions(search?: string): Promise<{
  noticeNo: number;
  sites: SiteOption[];
  contractors: ContractorOption[];
  workers: WorkerRow[];
  violationTypes: ViolationTypeOption[];
  siteMapping: {
    minaSiteId: number | null;
    arafatSiteId: number | null;
    muzdalifahSiteId: number | null;
  };
}> {
  const supabase = createSupabaseAdminClient();
  const [{ data: lastRow, error: lastError }, violationTypes] = await Promise.all([
    supabase.from("worker_violations").select("id").order("id", { ascending: false }).limit(1),
    ensureNoticeViolationTypes(),
  ]);
  if (lastError) throw new Error(`Last violation query failed: ${lastError.message}`);

  const [{ data: sites, error: siteError }, { data: contractors, error: contractorError }] =
    await Promise.all([
      supabase.from("sites").select("id, name").order("name"),
      supabase.from("contractors").select("id, name").eq("is_active", true).order("name"),
    ]);

  if (siteError) throw new Error(`Sites query failed: ${siteError.message}`);
  if (contractorError) throw new Error(`Contractors query failed: ${contractorError.message}`);

  let workersQuery = supabase
    .from("workers")
    .select("id, name, id_number, current_site_id, is_active, is_deleted")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("id", { ascending: false })
    .limit(50);

  if (search && search.trim()) {
    const value = search.trim();
    workersQuery = workersQuery.or(`name.ilike.%${value}%,id_number.ilike.%${value}%`);
  }

  const { data: workers, error: workerError } = await workersQuery;
  if (workerError) throw new Error(`Workers query failed: ${workerError.message}`);

  const siteOptions = (sites as SiteOption[]) ?? [];
  return {
    noticeNo: ((lastRow?.[0]?.id as number | undefined) ?? 0) + 1,
    sites: siteOptions,
    contractors: (contractors as ContractorOption[]) ?? [],
    workers: (workers as WorkerRow[]) ?? [],
    violationTypes,
    siteMapping: mapSiteByKeyword(siteOptions),
  };
}

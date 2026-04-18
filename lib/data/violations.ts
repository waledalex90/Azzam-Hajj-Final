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
import { isDemoModeEnabled } from "@/lib/demo-mode";

type ViolationsPageParams = {
  page: number;
  pageSize: number;
  siteId?: number;
  status?: "pending_review" | "needs_more_info" | "approved" | "rejected";
  /** yyyy-mm-dd */
  dateFrom?: string;
  dateTo?: string;
  /** 1 صباحي، 2 مسائي */
  shiftRound?: number;
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
  dateFrom,
  dateTo,
  shiftRound,
}: ViolationsPageParams): Promise<{ rows: ViolationRow[]; meta: PaginationMeta }> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase.rpc("get_violations_report_page", {
    p_date_from: dateFrom?.trim() || null,
    p_date_to: dateTo?.trim() || null,
    p_site_id: siteId && Number.isFinite(siteId) ? siteId : null,
    p_status: status ?? null,
    p_shift_round: shiftRound === 1 || shiftRound === 2 ? shiftRound : null,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) {
    throw new Error(`Violations report RPC failed: ${error.message}`);
  }

  type RpcRow = {
    id: number;
    worker_id: number;
    site_id: number;
    description: string | null;
    status: ViolationRow["status"];
    occurred_at: string;
    worker_name: string;
    worker_id_number: string;
    site_name: string;
    violation_type_name: string;
    deduction_sar: number;
    total_count: number;
  };

  const list = (data ?? []) as RpcRow[];
  const totalRows = list[0] ? Number(list[0].total_count) : 0;

  const rows: ViolationRow[] = list.map((item) => ({
    id: item.id,
    worker_id: item.worker_id,
    site_id: item.site_id,
    description: item.description,
    status: item.status,
    occurred_at: item.occurred_at,
    deduction_sar: Number(item.deduction_sar),
    workers: { name: item.worker_name, id_number: item.worker_id_number },
    sites: { name: item.site_name },
    violation_types: { name_ar: item.violation_type_name },
  }));

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
  if (isDemoModeEnabled()) {
    const { data, error } = await supabase
      .from("violation_types")
      .select("id, name_ar")
      .eq("is_active", true)
      .order("id");
    if (error) throw new Error(`Notice violation types query failed: ${error.message}`);
    return (data as ViolationTypeOption[]) ?? [];
  }
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

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

/** أنواع مذكورة في إشعار مخالفة المقاول فقط — تُزامَن في جدول violation_types بالـ code ولا تُعرَض كقائمة عامل عامة */
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

/** مفاتيح الموقع كما تُحفظ في نص إشعار المقاول (ليس أسماء عربية) */
export type NoticeSiteKey = "mina" | "arafat" | "muzdalifah";

export type ParsedInfractionNotice = {
  noticeNo: string;
  siteKey: NoticeSiteKey | null;
  complexNo: string;
  contractorName: string;
  supervisorName: string;
  delegateName: string;
  violationTypesLine: string;
  extraNotes: string;
};

function parseNoticeSiteKey(raw: string): NoticeSiteKey | null {
  const v = raw.trim();
  if (v === "mina" || v === "arafat" || v === "muzdalifah") return v;
  return null;
}

/** يستخرج حقول إشعار المقاول من عمود description (قبل سطر سجل الخصم) */
export function parseInfractionNoticeDescription(description: string | null): ParsedInfractionNotice | null {
  if (!description?.includes("إشعار مخالفة")) return null;
  const head = description.split("\n---\n")[0] ?? description;
  const lines = head
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  if (lines.length < 7) return null;
  const noticeNo = lines[0].match(/إشعار مخالفة رقم (\d+)/)?.[1] ?? "";
  let i = 1;
  const siteRaw = lines[i]?.replace(/^الموقع:\s*/, "").trim() ?? "";
  i += 1;
  let complexNo = "";
  if (lines[i]?.startsWith("رقم مجمع:")) {
    complexNo = lines[i].replace(/^رقم مجمع:\s*/, "").trim();
    i += 1;
  }
  const contractorName = lines[i]?.replace(/^المقاول:\s*/, "").trim() ?? "";
  i += 1;
  const supervisorName = lines[i]?.replace(/^اسم مشرف المقاول:\s*/, "").trim() ?? "";
  i += 1;
  const delegateName = lines[i]?.replace(/^المندوب:\s*/, "").trim() ?? "";
  i += 1;
  const violationTypesLine = lines[i]?.replace(/^تفاصيل المخالفة:\s*/, "").trim() ?? "";
  i += 1;
  const extraNotes = lines[i]?.replace(/^ملاحظات:\s*/, "").trim() ?? "";
  return {
    noticeNo,
    siteKey: parseNoticeSiteKey(siteRaw),
    complexNo,
    contractorName,
    supervisorName,
    delegateName,
    violationTypesLine,
    extraNotes,
  };
}

export type ContractorNoticeListItem = {
  /** أي سجل من حزمة الإشعار (نفس العامل والوقت) */
  id: number;
  noticeNo: string;
  occurredAt: string;
  workerId: number;
  workerName: string;
  contractorName: string;
};

/** إشعارات مقاول حديثة (مجمّعة بحسب عامل + وقت التسجيل) */
export async function getRecentContractorNotices(limit: number): Promise<ContractorNoticeListItem[]> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase
    .from("worker_violations")
    .select("id, occurred_at, worker_id, description")
    .ilike("description", "%إشعار مخالفة رقم%")
    .order("id", { ascending: false })
    .limit(120);
  if (error) throw new Error(`Recent contractor notices failed: ${error.message}`);

  const rows = data ?? [];
  const seen = new Set<string>();
  const out: ContractorNoticeListItem[] = [];

  const workerIds = Array.from(new Set(rows.map((r) => r.worker_id as number)));
  const { data: workers } = await supabase
    .from("workers")
    .select("id, name, contractor_id")
    .in("id", workerIds.length ? workerIds : [0]);
  const workerMap = new Map((workers ?? []).map((w) => [w.id as number, w]));

  const contractorIds = Array.from(
    new Set(
      (workers ?? [])
        .map((w) => w.contractor_id as number | null)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  );
  const { data: contractors } = await supabase
    .from("contractors")
    .select("id, name")
    .in("id", contractorIds.length ? contractorIds : [0]);
  const contractorMap = new Map((contractors ?? []).map((c) => [c.id as number, c.name as string]));

  for (const row of rows) {
    const key = `${row.worker_id}|${row.occurred_at}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const parsed = parseInfractionNoticeDescription(row.description as string | null);
    const noticeNo = parsed?.noticeNo ?? "?";
    const w = workerMap.get(row.worker_id as number);
    const cname = w?.contractor_id ? contractorMap.get(w.contractor_id as number) ?? "—" : "—";
    out.push({
      id: row.id as number,
      noticeNo,
      occurredAt: row.occurred_at as string,
      workerId: row.worker_id as number,
      workerName: w?.name ?? "—",
      contractorName: cname,
    });
    if (out.length >= limit) break;
  }

  return out;
}

export type NoticeBundleView = {
  primaryViolationId: number;
  worker: WorkerRow;
  contractorId: number | null;
  siteKey: NoticeSiteKey;
  occurredAtIso: string;
  parsed: ParsedInfractionNotice;
  violationTypeIds: number[];
  /** من أول سجل في الحزمة */
  attachmentUrls: string[];
};

function mergeWorkerIntoList(workers: WorkerRow[], extra: WorkerRow): WorkerRow[] {
  if (workers.some((w) => w.id === extra.id)) return workers;
  return [extra, ...workers];
}

/** يجلب حزمة إشعار مقاول لعرض/طباعة (سجلات متعددة لنفس الإشعار) */
export async function getNoticeBundleForView(
  violationId: number,
  workersForSelect: WorkerRow[],
): Promise<{ bundle: NoticeBundleView; workers: WorkerRow[] } | null> {
  const supabase = createSupabaseAdminClient();
  type WvRow = {
    id: number;
    description: string | null;
    occurred_at: string;
    worker_id: number;
    violation_type_id: number;
    attachment_urls?: string[] | null;
  };

  const { data: first, error: e1 } = await supabase
    .from("worker_violations")
    .select("id, description, occurred_at, worker_id, violation_type_id, attachment_urls")
    .eq("id", violationId)
    .maybeSingle<WvRow>();

  if (e1 || !first) return null;

  const { data: siblings, error: e2 } = await supabase
    .from("worker_violations")
    .select("id, violation_type_id, description, attachment_urls")
    .eq("worker_id", first.worker_id)
    .eq("occurred_at", first.occurred_at)
    .ilike("description", "%إشعار مخالفة رقم%");

  if (e2 || !siblings?.length) return null;

  const primary = siblings.reduce((a, b) => (a.id < b.id ? a : b));
  const parsed = parseInfractionNoticeDescription(primary.description);
  if (!parsed || !parsed.siteKey) return null;

  const violationTypeIds = Array.from(
    new Set(
      siblings
        .map((s) => (s as { violation_type_id: number }).violation_type_id)
        .filter((id) => Number.isFinite(id) && id > 0),
    ),
  );

  const { data: workerRow, error: we } = await supabase
    .from("workers")
    .select("id, name, id_number, contractor_id, current_site_id, is_active, is_deleted")
    .eq("id", first.worker_id)
    .single<WorkerRow>();

  if (we || !workerRow) return null;

  const urls =
    (primary as { attachment_urls?: string[] | null }).attachment_urls?.filter(Boolean) ?? [];

  const bundle: NoticeBundleView = {
    primaryViolationId: primary.id,
    worker: workerRow,
    contractorId: workerRow.contractor_id ?? null,
    siteKey: parsed.siteKey,
    occurredAtIso: first.occurred_at,
    parsed,
    violationTypeIds,
    attachmentUrls: urls,
  };

  const workers = mergeWorkerIntoList(workersForSelect, workerRow);
  return { bundle, workers };
}

const NOTICE_MEDIA_BUCKET = "violation-notices";
const NOTICE_MEDIA_MAX_BYTES = 45 * 1024 * 1024;

/** رفع صور/فيديو لإشعار المقاول؛ يتطلب bucket violation-notices في Supabase Storage */
export async function uploadContractorNoticeMediaFiles(workerId: number, files: File[]): Promise<string[]> {
  if (isDemoModeEnabled()) return [];
  const supabase = createSupabaseAdminClient();
  const urls: string[] = [];
  const list = files.filter((f) => f && typeof f.size === "number" && f.size > 0);
  for (let i = 0; i < list.length; i++) {
    const file = list[i];
    if (file.size > NOTICE_MEDIA_MAX_BYTES) continue;
    const safe = file.name.replace(/[^\w.\-() ]/g, "_").slice(0, 120);
    const path = `notices/${workerId}/${Date.now()}_${i}_${safe}`;
    const buf = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(NOTICE_MEDIA_BUCKET).upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (error) {
      console.error("violation-notice media upload:", error.message);
      continue;
    }
    const { data } = supabase.storage.from(NOTICE_MEDIA_BUCKET).getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}

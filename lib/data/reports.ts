import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type MonthlyMatrixRow = {
  worker_id: number;
  worker_name: string;
  id_number: string;
  day: string;
  status: "present" | "absent" | "half" | null;
};

export async function getMonthlyAttendanceMatrix(params: {
  year: number;
  month: number;
  siteId: number | null;
  contractorId: number | null;
  /** 1 صباحي، 2 مسائي */
  roundNo: number;
}): Promise<{ rows: MonthlyMatrixRow[]; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_monthly_attendance_matrix", {
    p_year: params.year,
    p_month: params.month,
    p_site_id: params.siteId,
    p_contractor_id: params.contractorId,
    p_round_no: params.roundNo,
  });

  if (error) {
    return { rows: [], error: error.message };
  }

  const raw = (data ?? []) as Array<{
    worker_id: number;
    worker_name: string;
    id_number: string;
    day: string;
    status: string | null;
  }>;

  const rows: MonthlyMatrixRow[] = raw.map((r) => ({
    worker_id: Number(r.worker_id),
    worker_name: String(r.worker_name ?? ""),
    id_number: String(r.id_number ?? ""),
    day: String(r.day ?? "").padStart(2, "0"),
    status:
      r.status === "present" || r.status === "absent" || r.status === "half"
        ? r.status
        : null,
  }));

  return { rows, error: null };
}

/** صف من تقرير الحضور/المسير (كل العمال، دفعات عبر RPC). */
export type WorkerFinancialReportRow = {
  worker_id: number;
  worker_name: string;
  id_number: string;
  job_title: string | null;
  contractor_id: number | null;
  contractor_name: string;
  site_name: string;
  payment_type: string;
  basic_salary: number | null;
  shift_round: number | null;
  equivalent_days: number;
  present_days: number;
  half_days: number;
  absent_days: number;
  violation_deductions: number;
  gross_due: number;
  net_due: number;
};

export type ContractorStatementRow = {
  contractor_id: number;
  contractor_name: string;
  worker_count: number;
  total_due: number;
  total_deductions: number;
  net_total: number;
};

const BATCH_LIMIT = 1000;

function mapFinancialRow(raw: Record<string, unknown>): WorkerFinancialReportRow {
  return {
    worker_id: Number(raw.worker_id),
    worker_name: String(raw.worker_name ?? ""),
    id_number: String(raw.id_number ?? ""),
    job_title: raw.job_title != null ? String(raw.job_title) : null,
    contractor_id: raw.contractor_id != null ? Number(raw.contractor_id) : null,
    contractor_name: String(raw.contractor_name ?? ""),
    site_name: String(raw.site_name ?? ""),
    payment_type: String(raw.payment_type ?? ""),
    basic_salary: raw.basic_salary != null ? Number(raw.basic_salary) : null,
    shift_round: raw.shift_round != null ? Number(raw.shift_round) : null,
    equivalent_days: Number(raw.equivalent_days ?? 0),
    present_days: Number(raw.present_days ?? 0),
    half_days: Number(raw.half_days ?? 0),
    absent_days: Number(raw.absent_days ?? 0),
    violation_deductions: Number(raw.violation_deductions ?? 0),
    gross_due: Number(raw.gross_due ?? 0),
    net_due: Number(raw.net_due ?? 0),
  };
}

/** null = كل الورديات (صباحي + مسائي) في التجميع. */
export function parseRoundNoFilter(value: unknown): number | null {
  const v = String(value ?? "").trim();
  if (v === "" || v === "all") return null;
  const n = Number(v);
  if (n === 1 || n === 2) return n;
  return null;
}

export async function countWorkersReportScope(params: {
  siteId: number | null;
  contractorId: number | null;
}): Promise<{ count: number; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("count_workers_report_scope", {
    p_site_id: params.siteId,
    p_contractor_id: params.contractorId,
  });
  if (error) return { count: 0, error: error.message };
  return { count: Number(data ?? 0), error: null };
}

export async function getWorkerFinancialReportAll(params: {
  from: string;
  to: string;
  siteId: number | null;
  contractorId: number | null;
  roundNo: number | null;
}): Promise<{ rows: WorkerFinancialReportRow[]; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const rows: WorkerFinancialReportRow[] = [];
  let afterId = 0;
  for (;;) {
    const { data, error } = await supabase.rpc("get_worker_financial_report_batch", {
      p_from: params.from,
      p_to: params.to,
      p_site_id: params.siteId,
      p_contractor_id: params.contractorId,
      p_round_no: params.roundNo,
      p_after_id: afterId,
      p_limit: BATCH_LIMIT,
    });
    if (error) return { rows: [], error: error.message };
    const batch = ((data ?? []) as Record<string, unknown>[]).map(mapFinancialRow);
    if (batch.length === 0) break;
    rows.push(...batch);
    afterId = batch[batch.length - 1]!.worker_id;
    if (batch.length < BATCH_LIMIT) break;
  }
  return { rows, error: null };
}

export async function getContractorsStatement(params: {
  from: string;
  to: string;
  siteId: number | null;
  contractorId: number | null;
  roundNo: number | null;
}): Promise<{ rows: ContractorStatementRow[]; error: string | null }> {
  const supabase = createSupabaseAdminClient();
  const { data, error } = await supabase.rpc("get_contractors_statement", {
    p_from: params.from,
    p_to: params.to,
    p_site_id: params.siteId,
    p_contractor_id: params.contractorId,
    p_round_no: params.roundNo,
  });
  if (error) return { rows: [], error: error.message };
  const raw = (data ?? []) as Array<Record<string, unknown>>;
  const rows: ContractorStatementRow[] = raw.map((r) => ({
    contractor_id: Number(r.contractor_id),
    contractor_name: String(r.contractor_name ?? ""),
    worker_count: Number(r.worker_count ?? 0),
    total_due: Number(r.total_due ?? 0),
    total_deductions: Number(r.total_deductions ?? 0),
    net_total: Number(r.net_total ?? 0),
  }));
  return { rows, error: null };
}

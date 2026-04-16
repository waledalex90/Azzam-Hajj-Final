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

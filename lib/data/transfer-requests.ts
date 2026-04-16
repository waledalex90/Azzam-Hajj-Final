import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { WorkerRow, WorkerTransferRequestRow } from "@/lib/types/db";

const LIMIT = 500;

type RawWtr = {
  id: number;
  worker_id: number;
  from_site_id: number | null;
  to_site_id: number;
  requested_by_app_user_id: number;
  status: string;
  destination_responded_by_app_user_id: number | null;
  destination_responded_at: string | null;
  destination_note: string | null;
  hr_responded_by_app_user_id: number | null;
  hr_responded_at: string | null;
  hr_note: string | null;
  created_at: string;
  updated_at: string;
};

async function hydrateRows(rows: RawWtr[]): Promise<WorkerTransferRequestRow[]> {
  if (rows.length === 0) return [];
  const supabase = createSupabaseAdminClient();
  const workerIds = [...new Set(rows.map((r) => r.worker_id))];
  const userIds = [
    ...new Set(
      rows.flatMap((r) => [r.requested_by_app_user_id, r.destination_responded_by_app_user_id, r.hr_responded_by_app_user_id].filter(Boolean)),
    ),
  ] as number[];
  const siteIds = [...new Set(rows.flatMap((r) => [r.from_site_id, r.to_site_id].filter((x): x is number => x != null)))];

  const [workersRes, usersRes, sitesRes] = await Promise.all([
    supabase.from("workers").select("id, name, id_number").in("id", workerIds),
    userIds.length
      ? supabase.from("app_users").select("id, full_name").in("id", userIds)
      : Promise.resolve({ data: [] as Array<{ id: number; full_name: string }> }),
    siteIds.length ? supabase.from("sites").select("id, name").in("id", siteIds) : Promise.resolve({ data: [] as Array<{ id: number; name: string }> }),
  ]);

  const wMap = new Map((workersRes.data as Array<{ id: number; name: string; id_number: string }> | null)?.map((w) => [w.id, w]) ?? []);
  const uMap = new Map((usersRes.data as Array<{ id: number; full_name: string }> | null)?.map((u) => [u.id, u]) ?? []);
  const sMap = new Map((sitesRes.data as Array<{ id: number; name: string }> | null)?.map((s) => [s.id, s]) ?? []);

  return rows.map((r) => ({
    id: r.id,
    worker_id: r.worker_id,
    from_site_id: r.from_site_id,
    to_site_id: r.to_site_id,
    requested_by_app_user_id: r.requested_by_app_user_id,
    status: r.status as WorkerTransferRequestRow["status"],
    destination_responded_by_app_user_id: r.destination_responded_by_app_user_id,
    destination_responded_at: r.destination_responded_at,
    destination_note: r.destination_note,
    hr_responded_by_app_user_id: r.hr_responded_by_app_user_id,
    hr_responded_at: r.hr_responded_at,
    hr_note: r.hr_note,
    created_at: r.created_at,
    updated_at: r.updated_at,
    worker: wMap.get(r.worker_id) ?? null,
    from_site: r.from_site_id != null ? sMap.get(r.from_site_id) ?? null : null,
    to_site: sMap.get(r.to_site_id) ?? null,
    requester: uMap.get(r.requested_by_app_user_id) ?? null,
    destination_responder: r.destination_responded_by_app_user_id
      ? uMap.get(r.destination_responded_by_app_user_id) ?? null
      : null,
    hr_responder: r.hr_responded_by_app_user_id ? uMap.get(r.hr_responded_by_app_user_id) ?? null : null,
  }));
}

export async function listTransferRequestsByStatus(
  statuses: WorkerTransferRequestRow["status"][],
  filters?: { toSiteIdIn?: number[] },
): Promise<WorkerTransferRequestRow[]> {
  if (filters?.toSiteIdIn !== undefined && filters.toSiteIdIn.length === 0) {
    return [];
  }
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("worker_transfer_requests")
    .select("*")
    .in("status", statuses)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (filters?.toSiteIdIn && filters.toSiteIdIn.length > 0) {
    q = q.in("to_site_id", filters.toSiteIdIn);
  }
  const { data, error } = await q;
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "PGRST116") return [];
    return [];
  }
  if (!data) return [];
  return hydrateRows(data as RawWtr[]);
}

export async function getTransferAlertCounts(params: {
  destinationSiteIds: number[];
  isHr: boolean;
}): Promise<{ destinationPending: number; hrPending: number }> {
  const supabase = createSupabaseAdminClient();
  let dest = 0;
  let hr = 0;

  if (params.destinationSiteIds.length > 0) {
    const { count, error } = await supabase
      .from("worker_transfer_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_destination")
      .in("to_site_id", params.destinationSiteIds);
    if (!error) dest = count ?? 0;
  }

  if (params.isHr) {
    const { count, error } = await supabase
      .from("worker_transfer_requests")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending_hr");
    if (!error) hr = count ?? 0;
  }

  return { destinationPending: dest, hrPending: hr };
}

type RawWorker = {
  id: number;
  name: string;
  id_number: string;
  contractor_id: number | null;
  current_site_id: number | null;
  is_active: boolean;
  is_deleted: boolean;
  sites?: { name: string } | { name: string }[] | null;
  contractors?: { name: string } | { name: string }[] | null;
};

/** عمال يمكن طلب نقلهم: من مواقع المراقب (أو الكل للأدمن/فني/موارد). */
export async function getWorkersForTransferPicker(params: {
  siteIds: number[] | null;
  q?: string;
}): Promise<WorkerRow[]> {
  if (params.siteIds && params.siteIds.length === 0) {
    return [];
  }
  const supabase = createSupabaseAdminClient();
  let q = supabase
    .from("workers")
    .select("id, name, id_number, contractor_id, current_site_id, is_active, is_deleted, sites(name), contractors(name)")
    .eq("is_active", true)
    .eq("is_deleted", false)
    .order("id", { ascending: true })
    .limit(8000);

  if (params.siteIds && params.siteIds.length > 0) {
    q = q.in("current_site_id", params.siteIds);
  }
  if (params.q?.trim()) {
    const v = params.q.trim();
    q = q.or(`name.ilike.%${v}%,id_number.ilike.%${v}%`);
  }

  const { data, error } = await q;
  if (error) {
    const code = (error as { code?: string }).code;
    if (code === "42P01" || code === "PGRST116") return [];
    return [];
  }
  if (!data) return [];

  return ((data as RawWorker[]) ?? []).map((item) => ({
    ...item,
    sites: Array.isArray(item.sites) ? (item.sites[0] ?? null) : (item.sites ?? null),
    contractors: Array.isArray(item.contractors) ? (item.contractors[0] ?? null) : (item.contractors ?? null),
  }));
}

export async function listTransferRequestsHistory(): Promise<WorkerTransferRequestRow[]> {
  return listTransferRequestsByStatus(["approved", "rejected_destination", "rejected_hr"]);
}

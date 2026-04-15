import type { AppRole } from "@/lib/constants/roles";

export type AppUser = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  username: string;
  role: AppRole;
};

export type WorkerRow = {
  id: number;
  name: string;
  id_number: string;
  current_site_id: number | null;
  is_active: boolean;
  is_deleted: boolean;
  sites?: { name: string } | null;
};

export type ViolationRow = {
  id: number;
  worker_id: number;
  site_id: number;
  description: string | null;
  status: "pending_review" | "needs_more_info" | "approved" | "rejected";
  occurred_at: string;
  workers?: { name: string; id_number: string } | null;
  sites?: { name: string } | null;
  violation_types?: { name_ar: string } | null;
};

export type PaginationMeta = {
  page: number;
  pageSize: number;
  totalRows: number;
  totalPages: number;
};

export type SiteOption = {
  id: number;
  name: string;
};

export type ViolationTypeOption = {
  id: number;
  name_ar: string;
};

export type ContractorOption = {
  id: number;
  name: string;
};

export type DashboardStats = {
  presentToday: number;
  absentToday: number;
  violationsToday: number;
};

export type TopStats = {
  contractors: number;
  inactiveWorkers: number;
  activeWorkers: number;
  sites: number;
};

export type IqamaAlert = {
  id: number;
  name: string;
  id_number: string;
  iqama_expiry: string;
};

export type PendingCorrection = {
  id: number;
  reason: string | null;
  created_at: string;
};

export type LatestWorker = {
  id: number;
  name: string;
  id_number: string;
  created_at: string;
};

export type AdminDashboardData = {
  topStats: TopStats;
  iqamaAlerts: IqamaAlert[];
  pendingCorrections: PendingCorrection[];
  latestWorkers: LatestWorker[];
};

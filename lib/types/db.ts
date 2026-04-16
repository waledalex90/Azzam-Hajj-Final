export type AppUser = {
  id: number;
  auth_user_id: string | null;
  full_name: string;
  username: string;
  /** مطابق لـ user_roles.slug */
  role: string;
  /** من user_roles.name_ar أو تسمية افتراضية */
  roleLabel: string;
  /** مصفوفة صلاحيات من user_roles.permissions */
  permissions: string[];
};

export type WorkerRow = {
  id: number;
  name: string;
  id_number: string;
  contractor_id?: number | null;
  current_site_id: number | null;
  is_active: boolean;
  is_deleted: boolean;
  sites?: { name: string } | null;
  contractors?: { name: string } | null;
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
  halfToday: number;
  /** عمال لم يُسجَّل لهم حضور نهائي لهذا اليوم (يشمل الـ 3131 وتناقصهم) */
  pendingToday: number;
  totalActiveWorkers: number;
  violationsToday: number;
};

export type SiteAttendanceRow = {
  siteId: number;
  siteName: string;
  totalWorkers: number;
  present: number;
  absent: number;
  half: number;
  pending: number;
};

export type AttendanceDayStats = {
  total: number;
  pending: number;
  present: number;
  absent: number;
  half: number;
};

export type AttendanceCheckRow = {
  id: number;
  round_id: number;
  worker_id: number;
  status: "present" | "absent" | "half";
  confirmation_status: "pending" | "confirmed" | "rejected";
  /** يتطابق مع اعتماد نهائي؛ يُحدَّث من السيرفر عند إضافة العمود في قاعدة البيانات */
  is_approved?: boolean;
  checked_at: string;
  confirm_note: string | null;
  attendance_rounds?: { work_date: string; round_no: number; site_id?: number } | null;
  workers?: { name: string; id_number: string } | null;
  sites?: { name: string } | null;
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
  /** لقطة حضور اليوم لكل موقع (نفس منطق attendance_daily_summary) */
  siteAttendanceToday: SiteAttendanceRow[];
};

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
  /** معرفات المواقع المسموح بها؛ [] = غير مقيد */
  allowedSiteIds?: number[];
};

export type WorkerRow = {
  id: number;
  name: string;
  id_number: string;
  contractor_id?: number | null;
  current_site_id: number | null;
  /** من Excel: 1 صباحي، 2 مسائي؛ null = يظهر في كلا الورديتين في التحضير */
  shift_round?: number | null;
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
  /** خصم بالريال (من نوع المخالفة أو تعديل يدوي) */
  deduction_sar?: number;
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

export type WorkerTransferStatus =
  | "pending_destination"
  | "rejected_destination"
  | "pending_hr"
  | "rejected_hr"
  | "approved";

export type WorkerTransferRequestRow = {
  id: number;
  worker_id: number;
  from_site_id: number | null;
  to_site_id: number;
  requested_by_app_user_id: number;
  status: WorkerTransferStatus;
  destination_responded_by_app_user_id: number | null;
  destination_responded_at: string | null;
  destination_note: string | null;
  hr_responded_by_app_user_id: number | null;
  hr_responded_at: string | null;
  hr_note: string | null;
  created_at: string;
  updated_at: string;
  worker?: { name: string; id_number: string } | null;
  from_site?: { name: string } | null;
  to_site?: { name: string } | null;
  requester?: { full_name: string } | null;
  destination_responder?: { full_name: string } | null;
  hr_responder?: { full_name: string } | null;
};

export type AttendanceCheckRow = {
  id: number;
  round_id: number;
  worker_id: number;
  status: "present" | "absent" | "half";
  confirmation_status: "pending" | "confirmed" | "rejected";
  /** اختياري؛ مصدر الحقيقة للاعتماد هو confirmation_status — لا يُحدَّث من واجهة الاعتماد إن وُجد العمود */
  is_approved?: boolean;
  checked_at: string;
  confirm_note: string | null;
  attendance_rounds?: { work_date: string; round_no: number; site_id?: number } | null;
  workers?: { name: string; id_number: string } | null;
  /** موقع العامل الحالي من جدول workers (أولوية على موقع الجولة). */
  sites?: { name: string } | null;
  contractors?: { name: string } | null;
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

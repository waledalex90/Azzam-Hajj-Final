/**
 * مفاتيح صلاحية جزئية (granular) — تُخزَّن في user_roles.permissions كمصفوفة JSON.
 * القيم القديمة (prep، approval، …) تُوسَّع تلقائياً عبر LEGACY_GRANTS في lib/auth/permissions.ts
 * حتى تبقى الصفوف المخزَّنة قديماً تعمل دون ترحيل فوري.
 */
export const PERM = {
  /**
   * wildcard: يعادل «كل المفاتيح» — يُعرَّف فقط لدور «مدير النظام / سوبر» في user_roles.
   * لا تُسند الأسماء (slug) لأي منطق في الكود.
   */
  WILDCARD: "*",
  /**
   * رؤية/تحضير على مستوى كل المواقع (بدل الاعتماد على اسم دور).
   * تُعطى للمستخدمين الذين يحتاجون نطاقاً مؤسسياً واسعاً.
   */
  ACCESS_ALL_SITES: "access_all_sites",

  VIEW_DASHBOARD: "view_dashboard",

  VIEW_WORKERS: "view_workers",
  EDIT_WORKERS: "edit_workers",
  IMPORT_WORKERS: "import_workers",
  VIEW_WORKERS_SENSITIVE_DATA: "view_workers_sensitive_data",

  VIEW_SITES: "view_sites",
  EDIT_SITES: "edit_sites",

  VIEW_CONTRACTORS: "view_contractors",
  EDIT_CONTRACTORS: "edit_contractors",

  VIEW_ATTENDANCE: "view_attendance",
  EDIT_ATTENDANCE: "edit_attendance",
  APPROVE_ATTENDANCE: "approve_attendance",
  /**
   * تسجيل الحضور باسم «مراقب ميداني» (يملأ field_observer_id لا technical_observer_id).
   */
  ATTENDANCE_REGISTER_AS_FIELD: "attendance_register_as_field",
  REQUEST_ATTENDANCE_CORRECTION: "request_attendance_correction",

  VIEW_REPORTS: "view_reports",
  EXPORT_REPORTS: "export_reports",

  /** أذونات لكل تبويب تقرير — المعاينة تتطلب المفتاح؛ التصدير يتطلب نفس مفتاح التقرير + `export_reports`. */
  REPORT_ATTENDANCE_LOG: "report_attendance_log",
  REPORT_MATRIX: "report_matrix",
  REPORT_HORIZONTAL: "report_horizontal",
  REPORT_PAYROLL: "report_payroll",
  REPORT_CONTRACTORS: "report_contractors",
  REPORT_VIOLATIONS: "report_violations",
  REPORT_WORKERS: "report_workers",

  VIEW_CORRECTIONS_QUEUE: "view_corrections_queue",
  PROCESS_CORRECTIONS: "process_corrections",

  VIEW_TRANSFERS: "view_transfers",
  MANAGE_TRANSFERS: "manage_transfers",

  VIEW_VIOLATIONS: "view_violations",
  MANAGE_VIOLATIONS: "manage_violations",
  CREATE_VIOLATION_NOTICE: "create_violation_notice",

  MANAGE_USERS: "manage_users",
  MANAGE_ROLES: "manage_roles",
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];

/** مفاتيح صلاحية «تبويب تقرير» — للاستعلام و`requireAnyScreen` وواجهة التقارير. */
export const ALL_REPORT_TAB_PERMISSIONS: readonly string[] = [
  PERM.REPORT_ATTENDANCE_LOG,
  PERM.REPORT_MATRIX,
  PERM.REPORT_HORIZONTAL,
  PERM.REPORT_PAYROLL,
  PERM.REPORT_CONTRACTORS,
  PERM.REPORT_VIOLATIONS,
  PERM.REPORT_WORKERS,
];

/** قيم قديمة في JSON — كل قيمة توسِّع إلى مفاتيح جزئية (للتوافق مع البيانات المخزَّنة قبل التجزئة). */
export const LEGACY_GRANTS: Record<string, readonly string[]> = {
  prep: [PERM.VIEW_ATTENDANCE, PERM.EDIT_ATTENDANCE],
  /** اعتماد الحضور + معالجة طلبات التعديل (السلوك السابق لـ corrections/actions) */
  approval: [PERM.VIEW_ATTENDANCE, PERM.APPROVE_ATTENDANCE, PERM.PROCESS_CORRECTIONS],
  correction_request: [PERM.REQUEST_ATTENDANCE_CORRECTION],
  workers_import: [PERM.IMPORT_WORKERS, PERM.EDIT_WORKERS],
  users_manage: [PERM.MANAGE_USERS],
  roles_manage: [PERM.MANAGE_ROLES],
  dashboard: [PERM.VIEW_DASHBOARD],
  workers: [PERM.VIEW_WORKERS, PERM.EDIT_WORKERS, PERM.VIEW_WORKERS_SENSITIVE_DATA],
  sites: [PERM.VIEW_SITES, PERM.EDIT_SITES],
  contractors: [PERM.VIEW_CONTRACTORS, PERM.EDIT_CONTRACTORS],
  transfers: [PERM.VIEW_TRANSFERS, PERM.MANAGE_TRANSFERS],
  reports: [PERM.VIEW_REPORTS, PERM.EXPORT_REPORTS, ...ALL_REPORT_TAB_PERMISSIONS],
  /** قديم: عرض التقارير يوسّع إلى جميع تبويبات التقارير (حتى تبقى الأدوار المخزّنة دون مفاتيح جديدة). */
  view_reports: [PERM.VIEW_REPORTS, ...ALL_REPORT_TAB_PERMISSIONS],
  /** التصدير العام (مع تبويب التقرير) — بدون توسيع لكل التبويبات حتى نحافظ على فصل «معاينة فقط». */
  export_reports: [PERM.EXPORT_REPORTS],
  corrections_screen: [PERM.VIEW_CORRECTIONS_QUEUE, PERM.PROCESS_CORRECTIONS],
  violation_notice: [PERM.CREATE_VIOLATION_NOTICE],
  violations: [PERM.VIEW_VIOLATIONS, PERM.MANAGE_VIOLATIONS],
};

export type PermissionCatalogEntry = { key: string; label: string; group: string };

/** ترتيب العرض في نماذج الأدوار — مجمّع حسب المجال */
export const PERMISSION_CATALOG: PermissionCatalogEntry[] = [
  { group: "لوحة التحكم", key: PERM.VIEW_DASHBOARD, label: "عرض الرئيسية / لوحة التحكم" },

  { group: "الموظفون", key: PERM.VIEW_WORKERS, label: "عرض قائمة الموظفين والتصفح" },
  { group: "الموظفون", key: PERM.EDIT_WORKERS, label: "إضافة وتعديل وحذف موظف / تفعيل وإيقاف" },
  { group: "الموظفون", key: PERM.VIEW_WORKERS_SENSITIVE_DATA, label: "عرض بيانات حساسة (هوية، إقامة، راتب في النماذج)" },
  { group: "الموظفون", key: PERM.IMPORT_WORKERS, label: "استيراد العمال من ملفات" },

  { group: "المواقع والمقاولون", key: PERM.VIEW_SITES, label: "عرض المواقع" },
  { group: "المواقع والمقاولون", key: PERM.EDIT_SITES, label: "تعديل المواقع" },
  { group: "المواقع والمقاولون", key: PERM.VIEW_CONTRACTORS, label: "عرض المقاولين" },
  { group: "المواقع والمقاولون", key: PERM.EDIT_CONTRACTORS, label: "تعديل المقاولين" },

  { group: "الحضور والاعتماد", key: PERM.VIEW_ATTENDANCE, label: "عرض شاشة الحضور والمراجعة (قراءة)" },
  { group: "الحضور والاعتماد", key: PERM.EDIT_ATTENDANCE, label: "تسجيل وتعديل حالة الحضور (التحضير)" },
  { group: "الحضور والاعتماد", key: PERM.ATTENDANCE_REGISTER_AS_FIELD, label: "تسجيل الحضور نيابة عن الميدان (يُنسب لمراقب ميداني)" },
  { group: "الحضور والاعتماد", key: PERM.ACCESS_ALL_SITES, label: "نطاق كل المواقع (مؤسسي — غير مربوط بمواقع في الحساب)" },
  { group: "الحضور والاعتماد", key: PERM.APPROVE_ATTENDANCE, label: "اعتماد أو رفض سجلات الحضور" },
  { group: "الحضور والاعتماد", key: PERM.REQUEST_ATTENDANCE_CORRECTION, label: "طلب تعديل على سجل حضور (من الميدان)" },

  { group: "التقارير", key: PERM.VIEW_REPORTS, label: "وصول صفحة التقارير (يُنصح مع تحديد تبويبات أدناه أو يُوسَّع قديماً لكل التبويبات)" },
  { group: "التقارير", key: PERM.EXPORT_REPORTS, label: "تصدير تقرير (CSV / Excel / PDF) — يلزم تفعيل تبويب ذلك التقرير" },
  { group: "التقارير", key: PERM.REPORT_ATTENDANCE_LOG, label: "تقرير: سجل الحضور" },
  { group: "التقارير", key: PERM.REPORT_MATRIX, label: "تقرير: المصفوفة الشهرية" },
  { group: "التقارير", key: PERM.REPORT_HORIZONTAL, label: "تقرير: Horizontal Report" },
  { group: "التقارير", key: PERM.REPORT_PAYROLL, label: "تقرير: مسير الرواتب" },
  { group: "التقارير", key: PERM.REPORT_CONTRACTORS, label: "تقرير: مستخلص المقاولين" },
  { group: "التقارير", key: PERM.REPORT_VIOLATIONS, label: "تقرير: المخالفات" },
  { group: "التقارير", key: PERM.REPORT_WORKERS, label: "تقرير: بيانات العاملين" },

  { group: "طلبات التعديل", key: PERM.VIEW_CORRECTIONS_QUEUE, label: "عرض قائمة طلبات التعديل" },
  { group: "طلبات التعديل", key: PERM.PROCESS_CORRECTIONS, label: "معالجة طلبات التعديل (اعتماد/رفض إداري)" },

  { group: "نقل الموظفين", key: PERM.VIEW_TRANSFERS, label: "عرض طلبات النقل" },
  { group: "نقل الموظفين", key: PERM.MANAGE_TRANSFERS, label: "إنشاء والرد على طلبات النقل" },

  { group: "المخالفات", key: PERM.VIEW_VIOLATIONS, label: "عرض المخالفات" },
  { group: "المخالفات", key: PERM.MANAGE_VIOLATIONS, label: "إدارة حالة المخالفات" },
  { group: "المخالفات", key: PERM.CREATE_VIOLATION_NOTICE, label: "إشعار مخالفة" },

  { group: "الإدارة", key: PERM.MANAGE_USERS, label: "إدارة مستخدمي النظام" },
  { group: "الإدارة", key: PERM.MANAGE_ROLES, label: "إدارة الأدوار والصلاحيات" },
  { group: "الإدارة", key: PERM.WILDCARD, label: "كل الصلاحيات (مدير أعلى — مفتاح * فقط بقرار يدوي)" },
];

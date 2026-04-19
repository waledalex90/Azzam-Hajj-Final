/** مفاتيح ثابتة لمصفوفة الصلاحيات في جدول user_roles (permissions). */
export const PERM = {
  /** تحضير الحضور الميداني / تسجيل الحالة */
  PREP: "prep",
  /** اعتماد السجلات (فردي أو الاعتماد الشامل لجميع المعلّقين) */
  APPROVAL: "approval",
  /** طلب تعديل من المراقب إلى الإدارة */
  CORRECTION_REQUEST: "correction_request",
  /** استيراد العمال (ملفات) */
  WORKERS_IMPORT: "workers_import",
  /** إدارة مستخدمي النظام */
  USERS_MANAGE: "users_manage",
  /** إنشاء وتعديل الأدوار في user_roles */
  ROLES_MANAGE: "roles_manage",

  /** شاشة الرئيسية */
  DASHBOARD: "dashboard",
  /** شاشة الموظفين */
  WORKERS: "workers",
  /** شاشة المواقع */
  SITES: "sites",
  /** شاشة المقاولين */
  CONTRACTORS: "contractors",
  /** شاشة نقل الموظفين */
  TRANSFERS: "transfers",
  /** شاشة التقارير */
  REPORTS: "reports",
  /** شاشة طلبات التعديل (قائمة الاعتماد) */
  CORRECTIONS_SCREEN: "corrections_screen",
  /** شاشة إشعار المخالفة */
  VIOLATION_NOTICE: "violation_notice",
  /** شاشة المخالفات */
  VIOLATIONS: "violations",
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];

/** ترتيب العرض في نماذج الأدوار — يطابق الشريط الجانبي قدر الإمكان */
export const PERMISSION_CATALOG: Array<{ key: string; label: string }> = [
  { key: PERM.DASHBOARD, label: "الرئيسية" },
  { key: PERM.WORKERS, label: "الموظفين" },
  { key: PERM.SITES, label: "المواقع" },
  { key: PERM.CONTRACTORS, label: "المقاولين" },
  { key: PERM.PREP, label: "تسجيل الحضور (التحضير)" },
  { key: PERM.APPROVAL, label: "اعتماد الحضور" },
  { key: PERM.CORRECTION_REQUEST, label: "طلب تعديل (من الميدان)" },
  { key: PERM.TRANSFERS, label: "نقل الموظفين" },
  { key: PERM.REPORTS, label: "التقارير" },
  { key: PERM.CORRECTIONS_SCREEN, label: "طلبات التعديل (قائمة الاعتماد)" },
  { key: PERM.VIOLATION_NOTICE, label: "إشعار المخالفة" },
  { key: PERM.VIOLATIONS, label: "المخالفات" },
  { key: PERM.WORKERS_IMPORT, label: "استيراد العمال (ملفات)" },
  { key: PERM.USERS_MANAGE, label: "إدارة المستخدمين" },
  { key: PERM.ROLES_MANAGE, label: "إدارة الأدوار والصلاحيات" },
];

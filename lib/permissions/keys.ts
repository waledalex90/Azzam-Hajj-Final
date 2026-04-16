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
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];

export const PERMISSION_CATALOG: Array<{ key: string; label: string }> = [
  { key: PERM.PREP, label: "التحضير (تسجيل الحضور)" },
  { key: PERM.APPROVAL, label: "الاعتماد (فردي + الاعتماد الشامل)" },
  { key: PERM.CORRECTION_REQUEST, label: "طلب تعديل" },
  { key: PERM.WORKERS_IMPORT, label: "استيراد العمال" },
  { key: PERM.USERS_MANAGE, label: "إدارة المستخدمين" },
  { key: PERM.ROLES_MANAGE, label: "إدارة الأدوار والصلاحيات" },
];

export const ROLES = {
  admin: "admin",
  hr: "hr",
  fieldObserver: "field_observer",
  technicalObserver: "technical_observer",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

/** تسميات افتراضية عند عدم وجود صف في user_roles */
export const LEGACY_ROLE_LABELS: Record<string, string> = {
  admin: "مدير النظام",
  hr: "الموارد البشرية",
  field_observer: "مراقب ميداني",
  technical_observer: "مراقب فني",
};

/** @deprecated استخدم AppUser.roleLabel */
export const ROLE_LABELS: Record<AppRole, string> = {
  admin: LEGACY_ROLE_LABELS.admin,
  hr: LEGACY_ROLE_LABELS.hr,
  field_observer: LEGACY_ROLE_LABELS.field_observer,
  technical_observer: LEGACY_ROLE_LABELS.technical_observer,
};

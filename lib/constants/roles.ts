export const ROLES = {
  admin: "admin",
  hr: "hr",
  fieldObserver: "field_observer",
  technicalObserver: "technical_observer",
} as const;

export type AppRole = (typeof ROLES)[keyof typeof ROLES];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: "مدير النظام",
  hr: "الموارد البشرية",
  field_observer: "مراقب ميداني",
  technical_observer: "مراقب فني",
};

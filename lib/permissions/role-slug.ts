/** يطابق عمود role / enum app_role في PostgreSQL — يستبعد معرّفات خاطئة مثل "-" */
export const ROLE_SLUG_PATTERN = /^[a-z][a-z0-9_]*$/;

export function isValidRoleSlug(slug: string): boolean {
  return ROLE_SLUG_PATTERN.test(slug.trim());
}

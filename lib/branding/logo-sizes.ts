/**
 * أبعاد موحّدة للوجو الرسمي (نسبة 799:287).
 * `app` / `auth` / `shell` / `topNav` — نفس الظهور البصري لصفحة تسجيل الدخول (عرض تكيفي بحد أقصى 300px).
 */
const appLike =
  "h-auto w-full max-w-[min(100%,300px)] sm:max-w-[300px] mx-auto";

export const brandLogo = {
  app: appLike,
  /** @deprecated استخدم `app` — مُبقي للتوافق */
  shell: appLike,
  /** تسجيل الدخول */
  auth: appLike,
  /** شاشة التحميل — نفس النسبة، أعلى قليلاً على الشاشات الكبيرة */
  launch: "h-auto w-full max-w-[min(100%,300px)] sm:max-w-[320px] mx-auto",
  /** ترويسة */
  topNav: appLike,
  /** رأس تقارير (إن وُجد) */
  reports: "h-auto w-full max-w-[min(100%,200px)] sm:max-w-[200px] mx-auto",
} as const;

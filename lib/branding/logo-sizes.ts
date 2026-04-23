/**
 * أبعاد موحّدة للوجو الرسمي (نسبة 799:287) — تُستخدم في الشريط، الدخول، التحميل، الترويسة.
 * لا تغيّر الأبعاد بشكل كبير بين الشاشات حتى تبقى الهوية متناسقة.
 */
export const brandLogo = {
  /** شريط جانبي، ترويسة الجوال */
  shell: "h-auto w-[200px] max-w-full sm:w-[220px]",
  /** تسجيل الدخول */
  auth: "h-auto w-[min(90vw,280px)] sm:w-[300px] max-w-full",
  /** شاشة التحميل */
  launch: "h-auto w-[min(90vw,300px)] sm:w-[320px] max-w-full",
  /** ترويسة (أعلى المحتوى) */
  topNav: "h-auto w-[200px] max-w-full sm:w-[220px]",
  /** رأس صفحة التقارير */
  reports: "h-auto w-[160px] max-w-full sm:w-[200px]",
} as const;

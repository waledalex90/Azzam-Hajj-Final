/**
 * وضع العرض: يُفعَّل فقط بمتغيرات بيئة صريحة.
 * لا يُشغَّل افتراضياً حتى لا تُعرض بيانات الإنتاج كـ Demo.
 *
 * للعزل الآمن: مشروع Supabase منفصل + DEMO_ISOLATED=true.
 * إذا فُعّل DEMO دون عزل، تُمنع الكتابة لكن لا يُعتبر آمناً للعرض العام.
 */
export function isDemoModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_DEMO_MODE === "true" || process.env.DEMO_MODE === "true";
}

/** يُسمح باعتبار النسخة «عرض عملاء» فقط مع مشروع معزول صراحة. */
export function isIsolatedDemoDeployment(): boolean {
  return isDemoModeEnabled() && process.env.DEMO_ISOLATED === "true";
}

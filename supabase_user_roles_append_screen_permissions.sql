-- إضافة مفاتيح شاشات جديدة لصلاحيات الأدوار الموجودة (دمج بدون تكرار).
-- نفّذ بعد نشر كود التطبيق الذي يعرّف PERM الجديدة.

-- تحديث admin + hr بكل مفاتيح الشاشات (يمكن حذف السطور حسب الحاجة)
UPDATE public.user_roles
SET permissions = (
  SELECT coalesce(array_agg(DISTINCT x ORDER BY x), '{}')
  FROM unnest(
    coalesce(permissions, '{}'::text[]) || ARRAY[
      'dashboard',
      'workers',
      'sites',
      'contractors',
      'transfers',
      'reports',
      'corrections_screen',
      'violation_notice',
      'violations'
    ]
  ) AS t(x)
)
WHERE slug IN ('admin', 'hr');

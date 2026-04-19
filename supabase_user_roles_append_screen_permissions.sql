-- إضافة مفاتيح شاشات جديدة لصلاحيات الأدوار (عمود permissions من نوع jsonb = مصفوفة نصوص).
-- نفّذ في SQL Editor بعد نشر كود التطبيق.

UPDATE public.user_roles ur
SET permissions = (
  SELECT to_jsonb(array_agg(elem ORDER BY elem))
  FROM (
    SELECT jsonb_array_elements_text(coalesce(ur.permissions, '[]'::jsonb)) AS elem
    UNION
    SELECT unnest(
      ARRAY[
        'dashboard',
        'workers',
        'sites',
        'contractors',
        'transfers',
        'reports',
        'corrections_screen',
        'violation_notice',
        'violations'
      ]::text[]
    ) AS elem
  ) s
)
WHERE ur.slug IN ('admin', 'hr');

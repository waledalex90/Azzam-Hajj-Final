-- فصل صلاحيات المراقب الميداني (تحضير فقط) عن المراقب الفني (اعتماد + طلب تعديل).
-- نفّذ في SQL Editor بعد نشر كود التطبيق (يُحدّث صفوف user_roles الموجودة).

-- مراقب ميداني: prep + شاشات العمل الميداني — بدون approval ولا correction_request
UPDATE public.user_roles
SET permissions = '[
  "prep",
  "workers",
  "sites",
  "violations",
  "violation_notice",
  "transfers"
]'::jsonb
WHERE slug = 'field_observer';

-- مراقب فني: تحضير + اعتماد + طلب تعديل + شاشات الإشراف
UPDATE public.user_roles
SET permissions = '[
  "dashboard",
  "prep",
  "approval",
  "correction_request",
  "corrections_screen",
  "workers",
  "sites",
  "reports"
]'::jsonb
WHERE slug = 'technical_observer';

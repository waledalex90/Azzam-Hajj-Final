-- إشعار مخالفة المقاول: مرفقات (صور/فيديو) على سجل worker_violations
-- شغّل هذا الملف في SQL Editor في Supabase بعد النسخ الاحتياطي.

begin;

alter table public.worker_violations
  add column if not exists attachment_urls text[] not null default '{}';

comment on column public.worker_violations.attachment_urls is
  'روابط عامة أو مسارات تخزين لمرفقات إشعار المقاول (نفس القائمة لكل سجل في نفس الإشعار).';

commit;

-- =========================
-- Storage (يدوي من لوحة Supabase)
-- =========================
-- 1) أنشئ bucket باسم: violation-notices
-- 2) اجعله public إذا كنت تستخدم getPublicUrl في التطبيق، أو أضف سياسات signed URL
-- 3) مثال سياسة قراءة عامة (اختياري):
--    insert into storage.buckets (id, name, public) values ('violation-notices', 'violation-notices', true);

-- Dynamic roles: جدول user_roles + سياسات قراءة للمستخدمين المسجلين.
-- شغّل هذا الملف مرة واحدة في SQL Editor في مشروع Supabase (Production).
-- ترتيب التشغيل مع بقية الملفات: انظر supabase_exec_order.sql

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name_ar text not null,
  permissions jsonb not null default '[]'::jsonb,
  created_at timestamptz default now()
);

comment on table public.user_roles is 'تعريف الأدوار ومصفوفة الصلاحيات (مفاتيح جزئية مثل view_attendance و report_attendance_log لكل تبويب تقرير؛ القيم القديمة prep/reports/view_reports ما زالت تُدعم عبر LEGACY_GRANTS في التطبيق)';

-- بذور أولية تطابق السلوك السابق قبل الواجهة الديناميكية
insert into public.user_roles (slug, name_ar, permissions) values
(
  'admin',
  'مدير النظام',
  '["prep","approval","correction_request","workers_import","users_manage","roles_manage"]'::jsonb
),
(
  'hr',
  'الموارد البشرية',
  '["prep","approval","correction_request","workers_import","users_manage"]'::jsonb
),
(
  'technical_observer',
  'مراقب فني',
  '["dashboard","prep","approval","correction_request","corrections_screen","workers","sites","reports"]'::jsonb
),
(
  'field_observer',
  'مراقب ميداني',
  '["prep","workers","sites","violations","violation_notice","transfers"]'::jsonb
)
on conflict (slug) do nothing;

alter table public.user_roles enable row level security;

drop policy if exists "user_roles_select_authenticated" on public.user_roles;
create policy "user_roles_select_authenticated"
  on public.user_roles
  for select
  to authenticated
  using (true);

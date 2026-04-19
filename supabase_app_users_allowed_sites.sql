-- مواقع مسموحة + بريد تسجيل الدخول (مرآة لـ auth.users) لعرضه في لوحة الإدارة.
-- نفّذ في Supabase SQL Editor.

alter table public.app_users
  add column if not exists allowed_site_ids integer[] not null default '{}';

alter table public.app_users
  add column if not exists login_email text;

comment on column public.app_users.allowed_site_ids is
  'معرفات المواقع المسموح بها؛ مصفوفة فارغة تعني عدم تقييد النطاق (كل المواقع).';

comment on column public.app_users.login_email is
  'البريد المستخدم في Supabase Auth (للعرض والبحث).';

create index if not exists app_users_allowed_site_ids_gin
  on public.app_users using gin (allowed_site_ids);

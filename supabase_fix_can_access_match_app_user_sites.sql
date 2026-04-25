-- إصلاح: التحضير يعيد 0 صفوف رغم صحة الواجهة
-- السبب: app.current_user_site_ids() كانت تقرأ فقط من public.user_sites بينما النظام يربط المواقع بـ public.app_user_sites.
-- منطق can_access يتبع مفاتيح user_roles (انظر supabase_azzam_hajj_bootstrap) وليس أسماء أدوار.
-- يتطلب: app.has_granular_permission (من bootstrap أو ترحيل الأدوار).
-- نفّذ هذا الملف كاملاً في Supabase SQL Editor (مرة واحدة).

alter table public.app_users
  add column if not exists allowed_site_ids integer[] not null default '{}';

create table if not exists public.app_user_sites (
  app_user_id bigint not null references public.app_users (id) on delete cascade,
  site_id bigint not null references public.sites (id) on delete cascade,
  primary key (app_user_id, site_id)
);

create index if not exists idx_app_user_sites_site_id on public.app_user_sites (site_id);

create or replace function app.current_user_site_ids()
returns bigint[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select array_agg(distinct sid order by sid)
      from (
        select aus.site_id as sid
        from public.app_user_sites aus
        join public.app_users au on au.id = aus.app_user_id
        where au.auth_user_id = auth.uid()
        union
        select us.site_id as sid
        from public.user_sites us
        join public.app_users au on au.id = us.user_id
        where au.auth_user_id = auth.uid()
        union
        select x::bigint as sid
        from public.app_users au
        cross join lateral unnest(coalesce(au.allowed_site_ids, '{}'::integer[])) as x
        where au.auth_user_id = auth.uid()
          and cardinality(coalesce(au.allowed_site_ids, '{}'::integer[])) > 0
      ) s
    ),
    '{}'::bigint[]
  )
$$;

create or replace function app.can_access_site(p_site_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when
        app.has_granular_permission('*')
        or app.has_granular_permission('access_all_sites')
        or app.has_granular_permission('manage_users')
        or app.has_granular_permission('manage_roles')
      then
        true
      when
        app.has_granular_permission('attendance_register_as_field')
        and not app.has_granular_permission('edit_attendance')
        and not app.has_granular_permission('*')
      then
        p_site_id = any(app.current_user_site_ids())
      when
        (app.has_granular_permission('edit_attendance') or app.has_granular_permission('view_attendance'))
        and not app.has_granular_permission('attendance_register_as_field')
        and cardinality(app.current_user_site_ids()) = 0
      then
        true
      else
        p_site_id = any(app.current_user_site_ids())
    end
$$;

create or replace function app.can_access_worker(p_worker_id bigint)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    case
      when
        app.has_granular_permission('*')
        or app.has_granular_permission('access_all_sites')
        or app.has_granular_permission('manage_users')
        or app.has_granular_permission('manage_roles')
      then
        true
      when
        app.has_granular_permission('attendance_register_as_field')
        and not app.has_granular_permission('edit_attendance')
        and not app.has_granular_permission('*')
      then
        exists (
          select 1
          from public.workers w
          where w.id = p_worker_id
            and w.current_site_id is not null
            and w.current_site_id = any(app.current_user_site_ids())
        )
      when
        (app.has_granular_permission('edit_attendance') or app.has_granular_permission('view_attendance'))
        and not app.has_granular_permission('attendance_register_as_field')
        and cardinality(app.current_user_site_ids()) = 0
      then
        true
      else
        exists (
          select 1
          from public.workers w
          where w.id = p_worker_id
            and w.current_site_id is not null
            and w.current_site_id = any(app.current_user_site_ids())
        )
    end
$$;

comment on function app.current_user_site_ids() is
  'مواقع المستخدم: app_user_sites + user_sites (legacy) + allowed_site_ids غير الفارغة.';

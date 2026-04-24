-- MIGRATION: app_users.role text + helpers/RPC/RLS بعد DROP app.current_user_role (أدوار ديناميكية user_roles.slug)
-- نفّذ الملف كاملاً في Supabase → SQL Editor (دفعة واحدة داخل begin/commit). يعالج: enum app_role + غموض bulk 42725.
-- المرجع العام: supabase_exec_order.sql
--
-- إذا ظهر 42P13 (cannot change return type): نفّذ أولاً ثم أعد التشغيل من "create function app.current_user_role":
--   drop function if exists app.current_user_role() cascade;
begin;

alter table public.app_users
  alter column role type text using (role::text);

drop function if exists app.current_user_role() cascade;

create or replace function app.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select au.role
  from public.app_users au
  where au.auth_user_id = auth.uid()
  limit 1
$$;

create or replace function app.is_admin_or_hr()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(app.current_user_role() in ('admin', 'hr'), false)
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
      when app.current_user_role() in ('admin', 'hr', 'technical_observer') then true
      else p_site_id = any(app.current_user_site_ids())
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
      when app.current_user_role() in ('admin', 'hr', 'technical_observer') then true
      else exists (
        select 1
        from public.workers w
        where w.id = p_worker_id
          and w.current_site_id is not null
          and w.current_site_id = any(app.current_user_site_ids())
      )
    end
$$;

-- =========================
create or replace function app.start_attendance_round(
  p_site_id bigint,
  p_work_date date,
  p_round_no integer default null,
  p_notes text default null
)
returns public.attendance_rounds
language plpgsql
security definer
set search_path = public
as $$
declare
  v_creator_id bigint;
  v_role text;
  v_round_no integer;
  v_row public.attendance_rounds;
begin
  v_creator_id := app.current_user_id();
  v_role := app.current_user_role();

  if v_creator_id is null then
    raise exception 'Unauthorized user';
  end if;

  if v_role not in ('admin', 'hr', 'technical_observer') then
    raise exception 'Only admin/hr/technical_observer can start rounds';
  end if;

  if not app.can_access_site(p_site_id) then
    raise exception 'No site access';
  end if;

  if p_round_no is null then
    select coalesce(max(round_no), 0) + 1
    into v_round_no
    from public.attendance_rounds
    where site_id = p_site_id
      and work_date = p_work_date;
  else
    v_round_no := p_round_no;
  end if;

  insert into public.attendance_rounds(site_id, work_date, round_no, created_by, notes)
  values (p_site_id, p_work_date, v_round_no, v_creator_id, p_notes)
  on conflict (site_id, work_date, round_no)
  do update set notes = excluded.notes
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function app.submit_attendance_checks(
  p_round_id bigint,
  p_payload jsonb
)
returns table(inserted_count integer, updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id bigint;
  v_role text;
  v_site_id bigint;
  i_count integer := 0;
  u_count integer := 0;
begin
  v_user_id := app.current_user_id();
  v_role := app.current_user_role();
  if v_user_id is null then
    raise exception 'Unauthorized user';
  end if;
  if v_role not in ('admin', 'hr', 'technical_observer', 'field_observer') then
    raise exception 'Only admin/hr/technical_observer/field_observer can submit checks';
  end if;

  select site_id into v_site_id
  from public.attendance_rounds
  where id = p_round_id;

  if v_site_id is null then
    raise exception 'Round not found';
  end if;

  if not app.can_access_site(v_site_id) then
    raise exception 'No site access';
  end if;

  with normalized_payload as (
    select distinct on (worker_id)
      worker_id,
      status
    from (
      select
        (item->>'worker_id')::bigint as worker_id,
        (item->>'status')::public.attendance_status as status,
        ordinality
      from jsonb_array_elements(p_payload) with ordinality as input(item, ordinality)
    ) raw
    where worker_id is not null and status is not null
    order by worker_id, ordinality desc
  ),
  allowed_payload as (
    select np.worker_id, np.status
    from normalized_payload np
    where app.can_access_worker(np.worker_id)
  ),
  updated_rows as (
    update public.attendance_checks ac
    set status = ap.status,
        technical_observer_id = case when v_role = 'field_observer' then null else v_user_id end,
        checked_at = now(),
        confirmation_status = 'pending',
        field_observer_id = case when v_role = 'field_observer' then v_user_id else null end,
        confirmed_at = null,
        confirm_note = null,
        rejection_reason = null
    from allowed_payload ap
    where ac.round_id = p_round_id
      and ac.worker_id = ap.worker_id
    returning ac.id
  ),
  inserted_rows as (
    insert into public.attendance_checks(
      round_id, worker_id, status, technical_observer_id, field_observer_id, checked_at, confirmation_status
    )
    select
      p_round_id,
      ap.worker_id,
      ap.status,
      case when v_role = 'field_observer' then null else v_user_id end,
      case when v_role = 'field_observer' then v_user_id else null end,
      now(),
      'pending'
    from allowed_payload ap
    left join public.attendance_checks ac
      on ac.round_id = p_round_id and ac.worker_id = ap.worker_id
    where ac.id is null
    returning id
  )
  select
    (select count(*)::integer from inserted_rows),
    (select count(*)::integer from updated_rows)
  into i_count, u_count;

  return query select i_count, u_count;
end;
$$;

-- يستبدل app.submit_attendance_bulk_checks (شغّل drop ثم 4-معاملات فقط)
drop function if exists app.submit_attendance_bulk_checks(date, jsonb, text);

create or replace function app.submit_attendance_bulk_checks(
  p_work_date date,
  p_payload jsonb,
  p_notes text default null,
  p_round_no integer default 1
)
returns table(inserted_count integer, updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id bigint;
  v_role text;
  i_count integer := 0;
  u_count integer := 0;
  v_round integer;
begin
  v_round := greatest(1, least(coalesce(p_round_no, 1), 9));

  v_user_id := app.current_user_id();
  v_role := app.current_user_role();
  if v_user_id is null then
    raise exception 'Unauthorized user';
  end if;
  if v_role not in ('admin', 'hr', 'technical_observer', 'field_observer') then
    raise exception 'Only admin/hr/technical_observer/field_observer can submit checks';
  end if;

  with normalized_payload as (
    select distinct on (worker_id)
      worker_id,
      status
    from (
      select
        (item->>'worker_id')::bigint as worker_id,
        (item->>'status')::public.attendance_status as status,
        ordinality
      from jsonb_array_elements(p_payload) with ordinality as input(item, ordinality)
    ) raw
    where worker_id is not null and status is not null
    order by worker_id, ordinality desc
  ),
  scoped_workers as (
    select
      np.worker_id,
      np.status,
      w.current_site_id as site_id
    from normalized_payload np
    join public.workers w on w.id = np.worker_id
    where w.current_site_id is not null
      and app.can_access_worker(np.worker_id)
      and app.can_access_site(w.current_site_id)
  ),
  ensure_rounds as (
    insert into public.attendance_rounds(site_id, work_date, round_no, created_by, notes)
    select
      sw.site_id,
      p_work_date,
      v_round,
      v_user_id,
      p_notes
    from (select distinct site_id from scoped_workers) sw
    on conflict (site_id, work_date, round_no)
    do update set notes = coalesce(excluded.notes, attendance_rounds.notes)
    returning id, site_id
  ),
  round_map as (
    select ar.id as round_id, ar.site_id
    from public.attendance_rounds ar
    join (select distinct site_id from scoped_workers) sw on sw.site_id = ar.site_id
    where ar.work_date = p_work_date
      and ar.round_no = v_round
  ),
  payload_with_round as (
    select
      sw.worker_id,
      sw.status,
      rm.round_id
    from scoped_workers sw
    join round_map rm on rm.site_id = sw.site_id
  ),
  updated_rows as (
    update public.attendance_checks ac
    set status = pwr.status,
        technical_observer_id = case when v_role = 'field_observer' then null else v_user_id end,
        checked_at = now(),
        confirmation_status = 'pending',
        field_observer_id = case when v_role = 'field_observer' then v_user_id else null end,
        confirmed_at = null,
        confirm_note = null,
        rejection_reason = null
    from payload_with_round pwr
    where ac.round_id = pwr.round_id
      and ac.worker_id = pwr.worker_id
    returning ac.id
  ),
  inserted_rows as (
    insert into public.attendance_checks(
      round_id, worker_id, status, technical_observer_id, field_observer_id, checked_at, confirmation_status
    )
    select
      pwr.round_id,
      pwr.worker_id,
      pwr.status,
      case when v_role = 'field_observer' then null else v_user_id end,
      case when v_role = 'field_observer' then v_user_id else null end,
      now(),
      'pending'
    from payload_with_round pwr
    left join public.attendance_checks ac
      on ac.round_id = pwr.round_id and ac.worker_id = pwr.worker_id
    where ac.id is null
    returning id
  )
  select
    (select count(*)::integer from inserted_rows),
    (select count(*)::integer from updated_rows)
  into i_count, u_count;

  return query select i_count, u_count;
end;
$$;

create or replace function public.submit_attendance_bulk_checks(
  p_work_date date,
  p_payload jsonb,
  p_notes text default null,
  p_round_no integer default 1
)
returns table(inserted_count integer, updated_count integer)
language sql
security definer
set search_path = public
as $$
  select * from app.submit_attendance_bulk_checks(p_work_date, p_payload, p_notes, p_round_no);
$$;

grant execute on function public.submit_attendance_bulk_checks(date, jsonb, text, integer)
to anon, authenticated, service_role;

-- Final fix: expose bulk attendance RPC from public schema
-- Run this in Supabase SQL Editor on the production project.

create or replace function public.submit_attendance_bulk_checks(
  p_work_date date,
  p_payload jsonb,
  p_notes text default null
)
returns table(inserted_count integer, updated_count integer)
language sql
security definer
set search_path = public
as $$
  select * from app.submit_attendance_bulk_checks(p_work_date, p_payload, p_notes, 1);
$$;

grant execute on function public.submit_attendance_bulk_checks(date, jsonb, text)
to anon, authenticated, service_role;


create or replace function app.confirm_attendance_checks(
  p_round_id bigint,
  p_payload jsonb
)
returns table(confirmed_count integer, rejected_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id bigint;
  v_role text;
  v_site_id bigint;
  rec jsonb;
  v_worker_id bigint;
  v_action text;
  v_note text;
  c_count integer := 0;
  r_count integer := 0;
begin
  v_user_id := app.current_user_id();
  v_role := app.current_user_role();

  if v_user_id is null then
    raise exception 'Unauthorized user';
  end if;
  if v_role not in ('admin', 'hr', 'field_observer') then
    raise exception 'Only admin/hr/field_observer can confirm';
  end if;

  select site_id into v_site_id
  from public.attendance_rounds
  where id = p_round_id;

  if v_site_id is null then
    raise exception 'Round not found';
  end if;

  if not app.can_access_site(v_site_id) then
    raise exception 'No site access';
  end if;

  for rec in select * from jsonb_array_elements(p_payload)
  loop
    v_worker_id := (rec->>'worker_id')::bigint;
    v_action := lower(coalesce(rec->>'action', ''));
    v_note := rec->>'note';

    if v_action = 'confirm' then
      update public.attendance_checks
      set confirmation_status = 'confirmed',
          field_observer_id = v_user_id,
          confirmed_at = now(),
          confirm_note = v_note,
          rejection_reason = null
      where round_id = p_round_id and worker_id = v_worker_id;
      c_count := c_count + 1;
    elsif v_action = 'reject' then
      update public.attendance_checks
      set confirmation_status = 'rejected',
          field_observer_id = v_user_id,
          confirmed_at = now(),
          confirm_note = v_note,
          rejection_reason = coalesce(v_note, 'rejected by field observer')
      where round_id = p_round_id and worker_id = v_worker_id;
      r_count := r_count + 1;
    else
      raise exception 'Unknown action for worker %', v_worker_id;
    end if;
  end loop;

  return query select c_count, r_count;
end;
$$;


-- app_users
drop policy if exists app_users_select_self_or_admin on public.app_users;
create policy app_users_select_self_or_admin on public.app_users
for select
using (
  app.is_admin_or_hr()
  or auth_user_id = auth.uid()
);

drop policy if exists app_users_admin_manage on public.app_users;
create policy app_users_admin_manage on public.app_users
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

-- user_sites
drop policy if exists user_sites_select_visible on public.user_sites;
create policy user_sites_select_visible on public.user_sites
for select
using (
  app.is_admin_or_hr()
  or site_id = any(app.current_user_site_ids())
);

drop policy if exists user_sites_admin_manage on public.user_sites;
create policy user_sites_admin_manage on public.user_sites
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

-- contractors / sites
drop policy if exists contractors_read_all on public.contractors;
create policy contractors_read_all on public.contractors
for select using (auth.uid() is not null);

drop policy if exists contractors_admin_hr_write on public.contractors;
create policy contractors_admin_hr_write on public.contractors
for all
using (app.is_admin_or_hr())
with check (app.is_admin_or_hr());

drop policy if exists sites_read_scoped on public.sites;
create policy sites_read_scoped on public.sites
for select
using (
  app.is_admin_or_hr()
  or id = any(app.current_user_site_ids())
);

drop policy if exists sites_admin_hr_write on public.sites;
create policy sites_admin_hr_write on public.sites
for all
using (app.is_admin_or_hr())
with check (app.is_admin_or_hr());

-- workers
drop policy if exists workers_read_scoped on public.workers;
create policy workers_read_scoped on public.workers
for select
using (
  app.is_admin_or_hr()
  or current_site_id = any(app.current_user_site_ids())
);

drop policy if exists workers_admin_hr_manage on public.workers;
create policy workers_admin_hr_manage on public.workers
for all
using (app.is_admin_or_hr())
with check (app.is_admin_or_hr());

-- attendance_rounds
drop policy if exists attendance_rounds_read_scoped on public.attendance_rounds;
create policy attendance_rounds_read_scoped on public.attendance_rounds
for select
using (
  app.is_admin_or_hr()
  or site_id = any(app.current_user_site_ids())
);

drop policy if exists attendance_rounds_create_technical on public.attendance_rounds;
create policy attendance_rounds_create_technical on public.attendance_rounds
for insert
with check (
  app.current_user_role() in ('admin', 'hr', 'technical_observer')
  and app.can_access_site(site_id)
);

drop policy if exists attendance_rounds_update_admin_hr_tech on public.attendance_rounds;
create policy attendance_rounds_update_admin_hr_tech on public.attendance_rounds
for update
using (
  app.current_user_role() in ('admin', 'hr', 'technical_observer')
  and app.can_access_site(site_id)
)
with check (
  app.current_user_role() in ('admin', 'hr', 'technical_observer')
  and app.can_access_site(site_id)
);

-- attendance_checks
drop policy if exists attendance_checks_read_scoped on public.attendance_checks;
create policy attendance_checks_read_scoped on public.attendance_checks
for select
using (
  app.is_admin_or_hr()
  or exists (
    select 1 from public.attendance_rounds ar
    where ar.id = attendance_checks.round_id
      and ar.site_id = any(app.current_user_site_ids())
  )
);

drop policy if exists attendance_checks_insert_technical on public.attendance_checks;
create policy attendance_checks_insert_technical on public.attendance_checks
for insert
with check (
  app.current_user_role() in ('admin', 'hr', 'technical_observer')
  and app.can_access_worker(worker_id)
  and exists (
    select 1 from public.attendance_rounds ar
    where ar.id = attendance_checks.round_id
      and app.can_access_site(ar.site_id)
  )
);

drop policy if exists attendance_checks_update_confirm on public.attendance_checks;
create policy attendance_checks_update_confirm on public.attendance_checks
for update
using (
  app.current_user_role() in ('admin', 'hr', 'technical_observer', 'field_observer')
  and exists (
    select 1 from public.attendance_rounds ar
    where ar.id = attendance_checks.round_id
      and app.can_access_site(ar.site_id)
  )
)
with check (
  app.current_user_role() in ('admin', 'hr', 'technical_observer', 'field_observer')
  and exists (
    select 1 from public.attendance_rounds ar
    where ar.id = attendance_checks.round_id
      and app.can_access_site(ar.site_id)
  )
);

drop policy if exists attendance_checks_no_delete_non_admin on public.attendance_checks;
create policy attendance_checks_no_delete_non_admin on public.attendance_checks
for delete
using (app.current_user_role() = 'admin');

-- attendance_daily_summary
drop policy if exists attendance_summary_read_scoped on public.attendance_daily_summary;
create policy attendance_summary_read_scoped on public.attendance_daily_summary
for select
using (
  app.is_admin_or_hr()
  or site_id = any(app.current_user_site_ids())
);

drop policy if exists attendance_summary_admin_manage on public.attendance_daily_summary;
create policy attendance_summary_admin_manage on public.attendance_daily_summary
for all
using (app.current_user_role() = 'admin')
with check (app.current_user_role() = 'admin');

-- app.has_granular_permission: يتطلب جدول public.user_roles (انظر supabase_user_roles.sql)
create or replace function app.has_granular_permission(p_required text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j jsonb;
begin
  if auth.uid() is null or p_required is null or length(trim(p_required)) = 0 then
    return false;
  end if;
  if not exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'user_roles') then
    return false;
  end if;
  select ur.permissions into j
  from public.app_users au
  join public.user_roles ur on ur.slug = au.role
  where au.auth_user_id = auth.uid()
  limit 1;
  if j is null then
    return false;
  end if;
  if exists (
    select 1 from jsonb_array_elements_text(j) as e(perm) where e.perm = p_required
  ) then
    return true;
  end if;
  if p_required in ('view_violations', 'manage_violations') then
    if exists (select 1 from jsonb_array_elements_text(j) as e(perm) where e.perm = 'violations') then
      return true;
    end if;
  end if;
  if p_required = 'create_violation_notice' then
    if exists (select 1 from jsonb_array_elements_text(j) as e(perm) where e.perm = 'violation_notice') then
      return true;
    end if;
  end if;
  if p_required = 'report_violations' then
    if exists (select 1 from jsonb_array_elements_text(j) as e(perm) where e.perm in ('reports', 'view_reports')) then
      return true;
    end if;
  end if;
  return false;
end;
$$;

grant execute on function app.has_granular_permission(text) to authenticated, service_role, anon;

-- violation types
drop policy if exists violation_types_read_all on public.violation_types;
drop policy if exists violation_types_read_scoped on public.violation_types;
create policy violation_types_read_scoped on public.violation_types
for select
using (
  app.is_admin_or_hr()
  or app.has_granular_permission('view_violations')
  or app.has_granular_permission('manage_violations')
  or app.has_granular_permission('report_violations')
);

drop policy if exists violation_types_admin_hr_write on public.violation_types;
create policy violation_types_admin_hr_write on public.violation_types
for all
using (app.is_admin_or_hr())
with check (app.is_admin_or_hr());

-- worker violations
drop policy if exists worker_violations_read_scoped on public.worker_violations;
create policy worker_violations_read_scoped on public.worker_violations
for select
using (
  app.is_admin_or_hr()
  or (
    (app.has_granular_permission('view_violations') or app.has_granular_permission('manage_violations'))
    and app.can_access_site(site_id)
  )
);

drop policy if exists worker_violations_insert_scoped on public.worker_violations;
create policy worker_violations_insert_scoped on public.worker_violations
for insert
with check (
  app.is_admin_or_hr()
  or (
    app.has_granular_permission('manage_violations')
    and app.can_access_site(site_id)
    and app.can_access_worker(worker_id)
  )
);

drop policy if exists worker_violations_update_review_scoped on public.worker_violations;
create policy worker_violations_update_review_scoped on public.worker_violations
for update
using (
  app.is_admin_or_hr()
  or (app.has_granular_permission('manage_violations') and app.can_access_site(site_id))
)
with check (
  app.is_admin_or_hr()
  or (app.has_granular_permission('manage_violations') and app.can_access_site(site_id))
);

drop policy if exists worker_violations_no_delete on public.worker_violations;
create policy worker_violations_no_delete on public.worker_violations
for delete
using (false);

-- violation evidence
drop policy if exists violation_evidence_read_scoped on public.violation_evidence;
create policy violation_evidence_read_scoped on public.violation_evidence
for select
using (
  exists (
    select 1
    from public.worker_violations v
    where v.id = violation_evidence.violation_id
      and (
        app.is_admin_or_hr()
        or (
          (app.has_granular_permission('view_violations') or app.has_granular_permission('manage_violations'))
          and app.can_access_site(v.site_id)
        )
      )
  )
);

drop policy if exists violation_evidence_insert_scoped on public.violation_evidence;
create policy violation_evidence_insert_scoped on public.violation_evidence
for insert
with check (
  (app.is_admin_or_hr() or app.has_granular_permission('manage_violations'))
  and exists (
    select 1
    from public.worker_violations v
    where v.id = violation_evidence.violation_id
      and app.can_access_site(v.site_id)
  )
);

drop policy if exists violation_evidence_no_delete on public.violation_evidence;
create policy violation_evidence_no_delete on public.violation_evidence
for delete
using (false);

-- violation history
drop policy if exists violation_history_read_scoped on public.violation_status_history;
create policy violation_history_read_scoped on public.violation_status_history
for select
using (
  exists (
    select 1
    from public.worker_violations v
    where v.id = violation_status_history.violation_id
      and (
        app.is_admin_or_hr()
        or (
          (app.has_granular_permission('view_violations') or app.has_granular_permission('manage_violations'))
          and app.can_access_site(v.site_id)
        )
      )
  )
);

drop policy if exists violation_history_admin_manage on public.violation_status_history;
drop policy if exists violation_status_history_no_write on public.violation_status_history;
drop policy if exists violation_status_history_no_delete on public.violation_status_history;
drop policy if exists violation_status_history_insert_chain on public.violation_status_history;
create policy violation_status_history_no_write on public.violation_status_history
for update
using (false);
create policy violation_status_history_no_delete on public.violation_status_history
for delete
using (false);
create policy violation_status_history_insert_chain on public.violation_status_history
for insert
with check (
  app.current_user_id() is not null
  and changed_by = app.current_user_id()
);

-- =========================
-- Storage bucket for violation photos
-- =========================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'violation-evidence',
  'violation-evidence',
  false,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

create or replace function app.violation_evidence_site_id_from_path(p_object_name text)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select (regexp_match(split_part(p_object_name, '/', 1), '^site_([0-9]+)$'))[1]::bigint
$$;

grant execute on function app.violation_evidence_site_id_from_path(text) to authenticated, service_role, anon;

drop policy if exists violation_evidence_bucket_select on storage.objects;
create policy violation_evidence_bucket_select on storage.objects
for select
using (
  bucket_id = 'violation-evidence'
  and auth.uid() is not null
  and (
    app.is_admin_or_hr()
    or (
      app.violation_evidence_site_id_from_path(name) is not null
      and (app.has_granular_permission('view_violations') or app.has_granular_permission('manage_violations'))
      and app.can_access_site(app.violation_evidence_site_id_from_path(name))
    )
  )
);

drop policy if exists violation_evidence_bucket_insert on storage.objects;
create policy violation_evidence_bucket_insert on storage.objects
for insert
with check (
  bucket_id = 'violation-evidence'
  and auth.uid() is not null
  and app.violation_evidence_site_id_from_path(name) is not null
  and (app.is_admin_or_hr() or app.has_granular_permission('manage_violations'))
  and app.can_access_site(app.violation_evidence_site_id_from_path(name))
);

drop policy if exists violation_evidence_bucket_update on storage.objects;
drop policy if exists violation_evidence_bucket_delete_admin on storage.objects;
drop policy if exists violation_evidence_bucket_no_update on storage.objects;
drop policy if exists violation_evidence_bucket_no_delete on storage.objects;
create policy violation_evidence_bucket_no_update on storage.objects
for update
using (false);
create policy violation_evidence_bucket_no_delete on storage.objects
for delete
using (false);
commit;

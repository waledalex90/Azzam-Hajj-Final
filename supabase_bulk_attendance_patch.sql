-- Bulk, set-based attendance save functions
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
  v_role public.app_role;
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

create or replace function app.submit_attendance_bulk_checks(
  p_work_date date,
  p_payload jsonb,
  p_notes text default null
)
returns table(inserted_count integer, updated_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id bigint;
  v_role public.app_role;
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
      1,
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
      and ar.round_no = 1
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

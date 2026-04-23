-- تشغيله في Supabase SQL Editor: يضيف دعم الوردية (round_no) لـ bulk attendance.
-- 1 = صباحي، 2 = مسائي.
-- يستبدل app.submit_attendance_bulk_checks و public.submit_attendance_bulk_checks.

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

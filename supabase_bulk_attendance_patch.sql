-- Patch: دفعة `submit_attendance_checks` (جولة=جولة) مع دعم المراقب الميداني في التسجيل.
-- لا يضيف `submit_attendance_bulk_checks` — مُدمَج في supabase_azzam_hajj_bootstrap.sql (4 معاملات) و`supabase_shift_round_rpc.sql`.
-- شغّل بعد `supabase_azzam_hajj_bootstrap` على مشروع **قائم** إن كنت تستبدل نسخة submit قديمة.
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
  v_as_field boolean;
  v_site_id bigint;
  i_count integer := 0;
  u_count integer := 0;
begin
  v_user_id := app.current_user_id();
  v_as_field := app.has_granular_permission('attendance_register_as_field');
  if v_user_id is null then
    raise exception 'Unauthorized user';
  end if;
  if not (
    app.has_granular_permission('*')
    or app.has_granular_permission('edit_attendance')
    or app.has_granular_permission('attendance_register_as_field')
  ) then
    raise exception 'No permission to submit attendance checks';
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
        technical_observer_id = case when v_as_field then null else v_user_id end,
        checked_at = now(),
        confirmation_status = 'pending',
        field_observer_id = case when v_as_field then v_user_id else null end,
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
      case when v_as_field then null else v_user_id end,
      case when v_as_field then v_user_id else null end,
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

-- التحضير الجماعي (بتاريخ + حمولة) مُعرَّف بصيغة 4 معاملات في supabase_shift_round_rpc.sql
-- (حذف النسخة بثلاثة معاملات من هنا لتفادي 42725: function ... is not unique عند النداء بثلاثة معاملات)

-- مصفوفة شهرية من attendance_checks + attendance_rounds (موقع الجولة التاريخي، حسب الوردية).
-- فقط سجلات معتمدة (confirmation_status = confirmed) — مرجع مالي.
-- استبدل الدالة القديمة ذات 4 معاملات إن وُجدت.
drop function if exists public.get_monthly_attendance_matrix(integer, integer, bigint, bigint);

create or replace function public.get_monthly_attendance_matrix(
  p_year integer,
  p_month integer,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_round_no integer default 1
)
returns table (
  worker_id bigint,
  worker_name text,
  id_number text,
  day text,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct on (w.id, ar.work_date)
    w.id as worker_id,
    w.name::text as worker_name,
    w.id_number::text as id_number,
    to_char(ar.work_date, 'DD') as day,
    ac.status::text as status
  from public.attendance_checks ac
  inner join public.attendance_rounds ar on ar.id = ac.round_id
  inner join public.workers w on w.id = ac.worker_id
  where w.is_active = true
    and w.is_deleted = false
    and ar.work_date >= date_trunc('month', make_date(p_year, p_month, 1))::date
    and ar.work_date < (date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month')::date
    and ar.round_no = greatest(1, least(coalesce(p_round_no, 1), 9))
    and ac.confirmation_status = 'confirmed'
    and (p_site_id is null or coalesce(ar.site_id, w.current_site_id) = p_site_id)
    and (p_contractor_id is null or w.contractor_id = p_contractor_id)
  order by w.id, ar.work_date, ac.checked_at desc nulls last;
$$;

comment on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint, integer) is
  'مصفوفة حضور شهرية حسب الوردية؛ موقع الجولة (ar.site_id) مع fallback لموقع العامل الحالي.';

revoke all on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint, integer) from public;
grant execute on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint, integer) to service_role;
grant execute on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint, integer) to authenticated;

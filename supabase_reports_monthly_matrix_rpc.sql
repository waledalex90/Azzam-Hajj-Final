-- تقرير شهري: مصفوفة حضور من attendance_daily_summary (الحالة النهائية لكل يوم).
-- نفّذ في Supabase SQL Editor ثم Reload schema إن لزم.
create or replace function public.get_monthly_attendance_matrix(
  p_year integer,
  p_month integer,
  p_site_id bigint default null,
  p_contractor_id bigint default null
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
  select
    w.id as worker_id,
    w.name::text as worker_name,
    w.id_number::text as id_number,
    to_char(ads.work_date, 'DD') as day,
    ads.final_status::text as status
  from public.attendance_daily_summary ads
  inner join public.workers w on w.id = ads.worker_id
  where w.is_active = true
    and w.is_deleted = false
    and ads.work_date >= date_trunc('month', make_date(p_year, p_month, 1))::date
    and ads.work_date < (date_trunc('month', make_date(p_year, p_month, 1)) + interval '1 month')::date
    and (p_site_id is null or coalesce(ads.site_id, w.current_site_id) = p_site_id)
    and (p_contractor_id is null or w.contractor_id = p_contractor_id)
  order by w.id, ads.work_date;
$$;

comment on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint) is
  'مصفوفة حضور شهرية من attendance_daily_summary (فلتر موقع/مقاول اختياري).';

revoke all on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint) from public;
grant execute on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint) to service_role;
grant execute on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint) to authenticated;

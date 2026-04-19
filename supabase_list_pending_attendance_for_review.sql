-- طابور «مراجعة تحضير اليوم» (التبويب الثاني): استعلام موحّد بأسماء ومواقع جاهزة لعرض أفقي.
-- التحضير يُخزَّن في public.attendance_checks؛ حالة «بانتظار الاعتماد» = confirmation_status = 'pending'.
-- لا يوجد جدول منفصل للنقل — الدالة تعرض (أو تُستدعى من API) نفس السجلات التي يقرأها التطبيق.
--
-- نفّذ في Supabase SQL Editor بعد النسخ الاحتياطي. يتطلب دوال app.* من supabase_azzam_hajj_bootstrap.sql.

begin;

create or replace function public.list_pending_attendance_for_review(
  p_work_date date,
  p_round_no integer default 1,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_search text default null
)
returns table(
  check_id bigint,
  round_id bigint,
  work_date date,
  round_no integer,
  round_site_id bigint,
  round_site_name text,
  display_site_id bigint,
  display_site_name text,
  worker_id bigint,
  worker_name text,
  id_number text,
  contractor_id bigint,
  contractor_name text,
  prep_status public.attendance_status,
  confirmation_status public.confirmation_status,
  checked_at timestamptz,
  field_observer_id bigint,
  technical_observer_id bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    ac.id as check_id,
    ar.id as round_id,
    ar.work_date,
    ar.round_no,
    ar.site_id as round_site_id,
    sr.name as round_site_name,
    coalesce(w.current_site_id, ar.site_id) as display_site_id,
    coalesce(sw.name, sr.name) as display_site_name,
    w.id as worker_id,
    w.name as worker_name,
    w.id_number,
    w.contractor_id,
    c.name as contractor_name,
    ac.status as prep_status,
    ac.confirmation_status,
    ac.checked_at,
    ac.field_observer_id,
    ac.technical_observer_id
  from public.attendance_checks ac
  join public.attendance_rounds ar on ar.id = ac.round_id
  join public.workers w on w.id = ac.worker_id
  left join public.sites sw on sw.id = w.current_site_id
  left join public.sites sr on sr.id = ar.site_id
  left join public.contractors c on c.id = w.contractor_id
  where ac.confirmation_status = 'pending'
    and ar.work_date = p_work_date
    and ar.round_no = greatest(1, least(coalesce(p_round_no, 1), 9))
    and (p_site_id is null or ar.site_id = p_site_id)
    and (p_contractor_id is null or w.contractor_id = p_contractor_id)
    and (
      trim(coalesce(p_search, '')) = ''
      or w.name ilike '%' || trim(p_search) || '%'
      or w.id_number ilike '%' || trim(p_search) || '%'
    )
    and (
      auth.role() = 'service_role'
      or app.is_admin_or_hr()
      or ar.site_id = any(app.current_user_site_ids())
    )
  order by ac.checked_at desc;
$$;

comment on function public.list_pending_attendance_for_review(date, integer, bigint, bigint, text) is
  'سجلات التحضير المعلّقة اعتماداً لتاريخ/وردية مع أسماء العامل والموقع (عرض أفقي / تبويب المراجعة).';

grant execute on function public.list_pending_attendance_for_review(date, integer, bigint, bigint, text)
  to authenticated, service_role;

commit;

-- إضافة فلتر بحث عامل (اسم / رقم هوية) لتقرير المخالفات الصفحي
-- شغّل في Supabase SQL Editor بعد النسخ الاحتياطي.

begin;

-- إزالة التوقيع القديم (7 وسطاء بدون بحث عامل) لتفادي التحميل
drop function if exists public.get_violations_report_page(date, date, bigint, text, smallint, integer, integer);

create or replace function public.get_violations_report_page(
  p_date_from date default null,
  p_date_to date default null,
  p_site_id bigint default null,
  p_status text default null,
  p_shift_round smallint default null,
  p_worker_search text default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  id bigint,
  worker_id bigint,
  site_id bigint,
  description text,
  status public.violation_status,
  occurred_at timestamptz,
  worker_name text,
  worker_id_number text,
  site_name text,
  violation_type_name text,
  deduction_sar numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      wv.id as vid,
      wv.worker_id as v_worker_id,
      wv.site_id as v_site_id,
      wv.description,
      wv.status as v_status,
      wv.occurred_at,
      w.name as wn,
      w.id_number as win,
      s.name as sn,
      vt.name_ar as vtn,
      coalesce(wv.deduction_sar, vt.deduction_sar, 0)::numeric(12, 2) as dval
    from public.worker_violations wv
    join public.workers w on w.id = wv.worker_id
    join public.sites s on s.id = wv.site_id
    join public.violation_types vt on vt.id = wv.violation_type_id
    where (p_site_id is null or wv.site_id = p_site_id)
      and (
        p_status is null
        or p_status = ''
        or wv.status = p_status::public.violation_status
      )
      and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or wv.site_id = any(app.current_user_site_ids())
      )
      and (
        p_date_from is null
        or (wv.occurred_at at time zone 'Asia/Riyadh')::date >= p_date_from
      )
      and (
        p_date_to is null
        or (wv.occurred_at at time zone 'Asia/Riyadh')::date <= p_date_to
      )
      and (
        trim(coalesce(p_worker_search, '')) = ''
        or w.name ilike '%' || trim(p_worker_search) || '%'
        or w.id_number ilike '%' || trim(p_worker_search) || '%'
      )
  ),
  numbered as (
    select
      b.*,
      count(*) over ()::bigint as tc
    from base b
  )
  select
    numbered.vid as id,
    numbered.v_worker_id as worker_id,
    numbered.v_site_id as site_id,
    numbered.description,
    numbered.v_status as status,
    numbered.occurred_at,
    numbered.wn as worker_name,
    numbered.win as worker_id_number,
    numbered.sn as site_name,
    numbered.vtn as violation_type_name,
    numbered.dval as deduction_sar,
    numbered.tc as total_count
  from numbered
  order by numbered.occurred_at desc
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 500)))
  limit greatest(1, least(p_page_size, 500));
$$;

grant execute on function public.get_violations_report_page(date, date, bigint, text, smallint, text, integer, integer) to service_role;

commit;

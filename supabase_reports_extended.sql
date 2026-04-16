-- تقارير موسّعة: نطاق حضور (كل العمال)، بيان مقاولين، مسير، وربط خصومات المخالفات.
-- نفّذ في Supabase SQL Editor. يضيف عمود penalty_amount إن لم يكن موجوداً.

alter table if exists public.worker_violations
  add column if not exists penalty_amount numeric(14, 2) default 0;

comment on column public.worker_violations.penalty_amount is
  'مبلغ خصم مالي (مرتبط بمسير الرواتب والمستخلصات؛ الافتراضي 0).';

-- عدد العمال المشمولين بالفلاتر (بدون حذف منطقي).
create or replace function public.count_workers_report_scope(
  p_site_id bigint default null,
  p_contractor_id bigint default null
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.workers w
  where w.is_deleted = false
    and (p_contractor_id is null or w.contractor_id = p_contractor_id)
    and (p_site_id is null or w.current_site_id = p_site_id);
$$;

-- تجميع حضور معتمد: صف واحد لكل (عامل، يوم عمل، رقم جولة) — أحدث check فقط (لا فقدان أيام).
create or replace function public.get_worker_financial_report_batch(
  p_from date,
  p_to date,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_round_no integer default null,
  p_after_id bigint default 0,
  p_limit integer default 1000
)
returns table (
  worker_id bigint,
  worker_name text,
  id_number text,
  job_title text,
  contractor_id bigint,
  contractor_name text,
  site_name text,
  payment_type text,
  basic_salary numeric,
  shift_round integer,
  equivalent_days numeric,
  present_days bigint,
  half_days bigint,
  absent_days bigint,
  violation_deductions numeric,
  gross_due numeric,
  net_due numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with daily_checks as (
    select distinct on (w.id, ar.work_date, ar.round_no)
      w.id as wid,
      ac.status as st
    from public.attendance_checks ac
    inner join public.attendance_rounds ar on ar.id = ac.round_id
    inner join public.workers w on w.id = ac.worker_id
    where w.is_deleted = false
      and ar.work_date >= p_from
      and ar.work_date <= p_to
      and ac.confirmation_status = 'confirmed'
      and (p_site_id is null or coalesce(ar.site_id, w.current_site_id) = p_site_id)
      and (p_contractor_id is null or w.contractor_id = p_contractor_id)
      and (p_round_no is null or ar.round_no = p_round_no)
    order by w.id, ar.work_date, ar.round_no, ac.checked_at desc nulls last
  ),
  agg as (
    select
      wid as worker_id,
      sum(
        case st
          when 'present' then 1::numeric
          when 'half' then 0.5::numeric
          else 0::numeric
        end
      ) as eq_days,
      count(*) filter (where st = 'present') as present_days,
      count(*) filter (where st = 'half') as half_days,
      count(*) filter (where st = 'absent') as absent_days
    from daily_checks
    group by wid
  ),
  viol as (
    select
      wv.worker_id as vid,
      coalesce(sum(wv.penalty_amount), 0)::numeric as total_penalty
    from public.worker_violations wv
    where wv.status = 'approved'
      and wv.occurred_at::date >= p_from
      and wv.occurred_at::date <= p_to
    group by wv.worker_id
  )
  select
    w.id as worker_id,
    w.name::text as worker_name,
    w.id_number::text as id_number,
    w.job_title::text as job_title,
    w.contractor_id,
    coalesce(c.name::text, '') as contractor_name,
    coalesce(s.name::text, '') as site_name,
    w.payment_type::text as payment_type,
    coalesce(w.basic_salary, 0)::numeric as basic_salary,
    w.shift_round,
    coalesce(a.eq_days, 0)::numeric as equivalent_days,
    coalesce(a.present_days, 0)::bigint as present_days,
    coalesce(a.half_days, 0)::bigint as half_days,
    coalesce(a.absent_days, 0)::bigint as absent_days,
    coalesce(v.total_penalty, 0)::numeric as violation_deductions,
    (
      case
        when w.payment_type::text = 'daily' then
          coalesce(w.basic_salary, 0)::numeric * coalesce(a.eq_days, 0)::numeric
        else
          (coalesce(w.basic_salary, 0)::numeric / 30.0) * coalesce(a.eq_days, 0)::numeric
      end
    )::numeric as gross_due,
    (
      (
        case
          when w.payment_type::text = 'daily' then
            coalesce(w.basic_salary, 0)::numeric * coalesce(a.eq_days, 0)::numeric
          else
            (coalesce(w.basic_salary, 0)::numeric / 30.0) * coalesce(a.eq_days, 0)::numeric
        end
      ) - coalesce(v.total_penalty, 0)::numeric
    )::numeric as net_due
  from public.workers w
  left join public.contractors c on c.id = w.contractor_id
  left join public.sites s on s.id = w.current_site_id
  left join agg a on a.worker_id = w.id
  left join viol v on v.vid = w.id
  where w.is_deleted = false
    and (p_contractor_id is null or w.contractor_id = p_contractor_id)
    and (p_site_id is null or w.current_site_id = p_site_id)
    and w.id > coalesce(p_after_id, 0)
  order by w.id asc
  limit greatest(1, least(coalesce(p_limit, 1000), 5000));
$$;

-- بيان المقاولين: تجميع من نفس منطق الأجور والخصومات.
create or replace function public.get_contractors_statement(
  p_from date,
  p_to date,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_round_no integer default null
)
returns table (
  contractor_id bigint,
  contractor_name text,
  worker_count bigint,
  total_due numeric,
  total_deductions numeric,
  net_total numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with daily_checks as (
    select distinct on (w.id, ar.work_date, ar.round_no)
      w.id as wid,
      ac.status as st
    from public.attendance_checks ac
    inner join public.attendance_rounds ar on ar.id = ac.round_id
    inner join public.workers w on w.id = ac.worker_id
    where w.is_deleted = false
      and ar.work_date >= p_from
      and ar.work_date <= p_to
      and ac.confirmation_status = 'confirmed'
      and (p_site_id is null or coalesce(ar.site_id, w.current_site_id) = p_site_id)
      and (p_contractor_id is null or w.contractor_id = p_contractor_id)
      and (p_round_no is null or ar.round_no = p_round_no)
    order by w.id, ar.work_date, ar.round_no, ac.checked_at desc nulls last
  ),
  agg as (
    select
      wid as worker_id,
      sum(
        case st
          when 'present' then 1::numeric
          when 'half' then 0.5::numeric
          else 0::numeric
        end
      ) as eq_days
    from daily_checks
    group by wid
  ),
  viol as (
    select
      wv.worker_id as vid,
      coalesce(sum(wv.penalty_amount), 0)::numeric as total_penalty
    from public.worker_violations wv
    where wv.status = 'approved'
      and wv.occurred_at::date >= p_from
      and wv.occurred_at::date <= p_to
    group by wv.worker_id
  ),
  per_worker as (
    select
      w.contractor_id as cid,
      w.id as wid,
      (
        case
          when w.payment_type::text = 'daily' then
            coalesce(w.basic_salary, 0)::numeric * coalesce(a.eq_days, 0)::numeric
          else
            (coalesce(w.basic_salary, 0)::numeric / 30.0) * coalesce(a.eq_days, 0)::numeric
        end
      )::numeric as gross,
      coalesce(v.total_penalty, 0)::numeric as vded
    from public.workers w
    left join agg a on a.worker_id = w.id
    left join viol v on v.vid = w.id
    where w.is_deleted = false
      and (p_contractor_id is null or w.contractor_id = p_contractor_id)
      and (p_site_id is null or w.current_site_id = p_site_id)
  )
  select
    coalesce(c.id, pw.cid, 0::bigint) as contractor_id,
    coalesce(c.name::text, 'بدون مقاول'::text) as contractor_name,
    count(*)::bigint as worker_count,
    coalesce(sum(pw.gross), 0)::numeric as total_due,
    coalesce(sum(pw.vded), 0)::numeric as total_deductions,
    coalesce(sum(pw.gross - pw.vded), 0)::numeric as net_total
  from per_worker pw
  left join public.contractors c on c.id = pw.cid
  where (p_contractor_id is null or pw.cid = p_contractor_id)
  group by coalesce(c.id, pw.cid, 0::bigint), coalesce(c.name::text, 'بدون مقاول'::text)
  order by contractor_name;
$$;

comment on function public.get_worker_financial_report_batch(date, date, bigint, bigint, integer, bigint, integer) is
  'تقرير مسير/حضور: كل العمال في نطاق الفلتر؛ تجميع حضور معتمد بدون ازدواجية يوم/جولة.';

comment on function public.get_contractors_statement(date, date, bigint, bigint, integer) is
  'بيان المقاولين: أعداد العمال والمستحق والخصومات (مخالفات معتمدة) والصافي.';

revoke all on function public.count_workers_report_scope(bigint, bigint) from public;
grant execute on function public.count_workers_report_scope(bigint, bigint) to service_role;
grant execute on function public.count_workers_report_scope(bigint, bigint) to authenticated;

revoke all on function public.get_worker_financial_report_batch(date, date, bigint, bigint, integer, bigint, integer) from public;
grant execute on function public.get_worker_financial_report_batch(date, date, bigint, bigint, integer, bigint, integer) to service_role;
grant execute on function public.get_worker_financial_report_batch(date, date, bigint, bigint, integer, bigint, integer) to authenticated;

revoke all on function public.get_contractors_statement(date, date, bigint, bigint, integer) from public;
grant execute on function public.get_contractors_statement(date, date, bigint, bigint, integer) to service_role;
grant execute on function public.get_contractors_statement(date, date, bigint, bigint, integer) to authenticated;

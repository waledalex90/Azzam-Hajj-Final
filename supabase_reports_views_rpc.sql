-- Reports: views + RPCs for Supabase (run after bootstrap / shift_round patch).
-- Idempotent: safe to re-run.

begin;

-- =========================
-- Deductions (مسير الرواتب ↔ المخالفات المعتمدة)
-- =========================
alter table public.violation_types
  add column if not exists deduction_sar numeric(12, 2) not null default 0;

comment on column public.violation_types.deduction_sar is
  'قيمة الخصم الافتراضية بالريال عند اعتماد المخالفة (يُستخدم في مسير الرواتب).';

alter table public.worker_violations
  add column if not exists deduction_sar numeric(12, 2);

comment on column public.worker_violations.deduction_sar is
  'خصم يدوي لهذه السجل؛ إن وُجد يُستخدم بدل deduction_sar من نوع المخالفة.';

-- =========================
-- View: خصومات معتمدة لكل عامل ضمن فترة (للمراجعة / تقارير)
-- =========================
create or replace view public.v_worker_approved_violation_deductions as
select
  wv.worker_id,
  (wv.occurred_at at time zone 'Asia/Riyadh')::date as occurred_date,
  wv.id as violation_id,
  wv.status,
  coalesce(wv.deduction_sar, vt.deduction_sar, 0)::numeric(12, 2) as deduction_sar
from public.worker_violations wv
join public.violation_types vt on vt.id = wv.violation_type_id
where wv.status = 'approved';

-- =========================
-- Monthly matrix: add shift filter + public RPC (PostgREST يستدعي public)
-- =========================
create or replace function app.get_monthly_attendance_matrix(
  p_year integer,
  p_month integer,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_shift_round smallint default null
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  d01 text, d02 text, d03 text, d04 text, d05 text, d06 text, d07 text, d08 text, d09 text, d10 text,
  d11 text, d12 text, d13 text, d14 text, d15 text, d16 text, d17 text, d18 text, d19 text, d20 text,
  d21 text, d22 text, d23 text, d24 text, d25 text, d26 text, d27 text, d28 text, d29 text, d30 text, d31 text,
  present_days numeric(8,2),
  absent_days numeric(8,2),
  half_days numeric(8,2)
)
language sql
stable
security definer
set search_path = public
as $$
with bounds as (
  select
    make_date(p_year, p_month, 1) as d_start,
    (make_date(p_year, p_month, 1) + interval '1 month' - interval '1 day')::date as d_end
),
base_workers as (
  select
    w.id,
    w.name as worker_name,
    w.id_number,
    s.name as site_name
  from public.workers w
  left join public.sites s on s.id = w.current_site_id
  where w.is_active = true
    and w.is_deleted = false
    and (p_site_id is null or w.current_site_id = p_site_id)
    and (p_contractor_id is null or w.contractor_id = p_contractor_id)
    and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
    and (
      auth.role() = 'service_role'
      or app.is_admin_or_hr()
      or w.current_site_id = any(app.current_user_site_ids())
    )
),
agg as (
  select
    ads.worker_id,
    ads.work_date,
    case ads.final_status
      when 'present' then 'P'
      when 'absent' then 'A'
      when 'half' then 'H'
      else ''
    end as mark,
    ads.present_points,
    ads.absent_points,
    ads.half_points
  from public.attendance_daily_summary ads
  join bounds b on ads.work_date between b.d_start and b.d_end
)
select
  bw.id as worker_id,
  bw.worker_name,
  bw.id_number,
  bw.site_name,
  max(agg.mark) filter (where extract(day from agg.work_date) = 1) as d01,
  max(agg.mark) filter (where extract(day from agg.work_date) = 2) as d02,
  max(agg.mark) filter (where extract(day from agg.work_date) = 3) as d03,
  max(agg.mark) filter (where extract(day from agg.work_date) = 4) as d04,
  max(agg.mark) filter (where extract(day from agg.work_date) = 5) as d05,
  max(agg.mark) filter (where extract(day from agg.work_date) = 6) as d06,
  max(agg.mark) filter (where extract(day from agg.work_date) = 7) as d07,
  max(agg.mark) filter (where extract(day from agg.work_date) = 8) as d08,
  max(agg.mark) filter (where extract(day from agg.work_date) = 9) as d09,
  max(agg.mark) filter (where extract(day from agg.work_date) = 10) as d10,
  max(agg.mark) filter (where extract(day from agg.work_date) = 11) as d11,
  max(agg.mark) filter (where extract(day from agg.work_date) = 12) as d12,
  max(agg.mark) filter (where extract(day from agg.work_date) = 13) as d13,
  max(agg.mark) filter (where extract(day from agg.work_date) = 14) as d14,
  max(agg.mark) filter (where extract(day from agg.work_date) = 15) as d15,
  max(agg.mark) filter (where extract(day from agg.work_date) = 16) as d16,
  max(agg.mark) filter (where extract(day from agg.work_date) = 17) as d17,
  max(agg.mark) filter (where extract(day from agg.work_date) = 18) as d18,
  max(agg.mark) filter (where extract(day from agg.work_date) = 19) as d19,
  max(agg.mark) filter (where extract(day from agg.work_date) = 20) as d20,
  max(agg.mark) filter (where extract(day from agg.work_date) = 21) as d21,
  max(agg.mark) filter (where extract(day from agg.work_date) = 22) as d22,
  max(agg.mark) filter (where extract(day from agg.work_date) = 23) as d23,
  max(agg.mark) filter (where extract(day from agg.work_date) = 24) as d24,
  max(agg.mark) filter (where extract(day from agg.work_date) = 25) as d25,
  max(agg.mark) filter (where extract(day from agg.work_date) = 26) as d26,
  max(agg.mark) filter (where extract(day from agg.work_date) = 27) as d27,
  max(agg.mark) filter (where extract(day from agg.work_date) = 28) as d28,
  max(agg.mark) filter (where extract(day from agg.work_date) = 29) as d29,
  max(agg.mark) filter (where extract(day from agg.work_date) = 30) as d30,
  max(agg.mark) filter (where extract(day from agg.work_date) = 31) as d31,
  coalesce(sum(agg.present_points), 0)::numeric(8,2) as present_days,
  coalesce(sum(agg.absent_points), 0)::numeric(8,2) as absent_days,
  coalesce(sum(agg.half_points), 0)::numeric(8,2) as half_days
from base_workers bw
left join agg on agg.worker_id = bw.id
group by bw.id, bw.worker_name, bw.id_number, bw.site_name
order by bw.worker_name;
$$;

create or replace function public.get_monthly_attendance_matrix(
  p_year integer,
  p_month integer,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_shift_round smallint default null
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  d01 text, d02 text, d03 text, d04 text, d05 text, d06 text, d07 text, d08 text, d09 text, d10 text,
  d11 text, d12 text, d13 text, d14 text, d15 text, d16 text, d17 text, d18 text, d19 text, d20 text,
  d21 text, d22 text, d23 text, d24 text, d25 text, d26 text, d27 text, d28 text, d29 text, d30 text, d31 text,
  present_days numeric(8,2),
  absent_days numeric(8,2),
  half_days numeric(8,2)
)
language sql
stable
security definer
set search_path = public
as $$
  select * from app.get_monthly_attendance_matrix(
    p_year, p_month, p_site_id, p_contractor_id, p_shift_round
  );
$$;

create or replace function public.get_monthly_attendance_matrix_page(
  p_year integer,
  p_month integer,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_shift_round smallint default null,
  p_page integer default 1,
  p_page_size integer default 20
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  d01 text, d02 text, d03 text, d04 text, d05 text, d06 text, d07 text, d08 text, d09 text, d10 text,
  d11 text, d12 text, d13 text, d14 text, d15 text, d16 text, d17 text, d18 text, d19 text, d20 text,
  d21 text, d22 text, d23 text, d24 text, d25 text, d26 text, d27 text, d28 text, d29 text, d30 text, d31 text,
  present_days numeric(8,2),
  absent_days numeric(8,2),
  half_days numeric(8,2),
  total_workers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with matrix as (
    select * from public.get_monthly_attendance_matrix(
      p_year, p_month, p_site_id, p_contractor_id, p_shift_round
    )
  ),
  numbered as (
    select
      m.*,
      count(*) over ()::bigint as total_workers
    from matrix m
  )
  select *
  from numbered
  order by worker_name
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 500)))
  limit greatest(1, least(p_page_size, 500));
$$;

-- =========================
-- مسير الرواتب: حضور معتمد (ملخص يومي من سجلات مؤكدة فقط) + خصومات مخالفات معتمدة
-- =========================
create or replace function public.get_payroll_report_page(
  p_date_start date,
  p_date_end date,
  p_site_id bigint default null,
  p_contractor_id bigint default null,
  p_shift_round smallint default null,
  p_page integer default 1,
  p_page_size integer default 25
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  contractor_name text,
  payment_type text,
  basic_salary numeric,
  paid_day_equivalent numeric,
  gross_sar numeric,
  deductions_sar numeric,
  net_sar numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with worker_base as (
    select
      w.id as wid,
      w.name as wname,
      w.id_number as wid_number,
      coalesce(s.name, 'غير محدد') as sname,
      coalesce(c.name, 'غير محدد') as cname,
      coalesce(w.payment_type, 'salary') as ptype,
      coalesce(w.basic_salary, 0)::numeric(12, 2) as basic
    from public.workers w
    left join public.sites s on s.id = w.current_site_id
    left join public.contractors c on c.id = w.contractor_id
    where w.is_active = true
      and w.is_deleted = false
      and (p_site_id is null or w.current_site_id = p_site_id)
      and (p_contractor_id is null or w.contractor_id = p_contractor_id)
      and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or w.current_site_id = any(app.current_user_site_ids())
      )
  ),
  paid as (
    select
      ads.worker_id as pid,
      sum(
        case ads.final_status
          when 'present' then 1::numeric
          when 'half' then 0.5::numeric
          else 0::numeric
        end
      ) as paid_days
    from public.attendance_daily_summary ads
    where ads.work_date between p_date_start and p_date_end
    group by ads.worker_id
  ),
  ded as (
    select
      wv.worker_id as did,
      sum(coalesce(wv.deduction_sar, vt.deduction_sar, 0))::numeric(12, 2) as dsum
    from public.worker_violations wv
    join public.violation_types vt on vt.id = wv.violation_type_id
    where wv.status = 'approved'
      and (wv.occurred_at at time zone 'Asia/Riyadh')::date between p_date_start and p_date_end
    group by wv.worker_id
  ),
  calc as (
    select
      wb.wid,
      wb.wname,
      wb.wid_number,
      wb.sname,
      wb.cname,
      wb.ptype,
      wb.basic,
      coalesce(p.paid_days, 0)::numeric(12, 4) as paid_eq,
      case
        when coalesce(p.paid_days, 0) = 0 then 0::numeric(12, 2)
        when wb.ptype = 'daily' then (coalesce(p.paid_days, 0) * wb.basic)::numeric(12, 2)
        else ((coalesce(p.paid_days, 0) / 30.0) * wb.basic)::numeric(12, 2)
      end as gross,
      coalesce(d.dsum, 0)::numeric(12, 2) as ded_amt
    from worker_base wb
    left join paid p on p.pid = wb.wid
    left join ded d on d.did = wb.wid
    where coalesce(p.paid_days, 0) > 0 or coalesce(d.dsum, 0) > 0
  ),
  counted as (
    select
      c.*,
      count(*) over ()::bigint as tc
    from calc c
  )
  select
    counted.wid as worker_id,
    counted.wname as worker_name,
    counted.wid_number as id_number,
    counted.sname as site_name,
    counted.cname as contractor_name,
    counted.ptype as payment_type,
    counted.basic as basic_salary,
    counted.paid_eq as paid_day_equivalent,
    counted.gross as gross_sar,
    counted.ded_amt as deductions_sar,
    (counted.gross - counted.ded_amt)::numeric(12, 2) as net_sar,
    counted.tc as total_count
  from counted
  order by counted.wname
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 500)))
  limit greatest(1, least(p_page_size, 500));
$$;

-- =========================
-- تقرير المخالفات (صفحات + فلاتر)
-- =========================
create or replace function public.get_violations_report_page(
  p_date_from date default null,
  p_date_to date default null,
  p_site_id bigint default null,
  p_status text default null,
  p_shift_round smallint default null,
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

grant execute on function public.get_monthly_attendance_matrix(integer, integer, bigint, bigint, smallint) to service_role;
grant execute on function public.get_monthly_attendance_matrix_page(integer, integer, bigint, bigint, smallint, integer, integer) to service_role;
grant execute on function public.get_payroll_report_page(date, date, bigint, bigint, smallint, integer, integer) to service_role;
grant execute on function public.get_violations_report_page(date, date, bigint, text, smallint, integer, integer) to service_role;

commit;

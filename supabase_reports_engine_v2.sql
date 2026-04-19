-- Reports Engine v2: multi-select (bigint[]), supervisor filter, server-side only.
-- Run after supabase_reports_views_rpc.sql + bootstrap.

begin;

-- ============== Payroll: manual deductions per worker + period (مسير الرواتب) ==============
create table if not exists public.payroll_manual_deductions (
  id bigint generated always as identity primary key,
  worker_id bigint not null references public.workers (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  amount_sar numeric(12, 2) not null default 0,
  updated_at timestamptz not null default now(),
  unique (worker_id, period_start, period_end)
);

create index if not exists idx_payroll_manual_deductions_period
  on public.payroll_manual_deductions (period_start, period_end);

-- تطبيع مصفوفات معرفات للمقارنة (فلاتر مسير الرواتب + قفل الاعتماد)
create or replace function app.normalize_bigint_ids(p_ids bigint[])
returns bigint[]
language sql
immutable
set search_path = public
as $$
  select case
    when p_ids is null or cardinality(p_ids) = 0 then '{}'::bigint[]
    else (select array_agg(distinct u order by u) from unnest(p_ids) as u)
  end
$$;

create or replace function app.payroll_ids_signature(p_ids bigint[])
returns text
language sql
immutable
set search_path = public
as $$
  select coalesce(
    (select string_agg(x::text, ',' order by x)
     from unnest(app.normalize_bigint_ids(p_ids)) as t(x)),
    ''
  );
$$;

-- قفل اعتماد المسير: نفس الفترة + نفس فلاتر المواقع/المقاولين/المشرفين
create table if not exists public.payroll_period_locks (
  id bigint generated always as identity primary key,
  period_start date not null,
  period_end date not null,
  site_ids bigint[] not null default '{}',
  contractor_ids bigint[] not null default '{}',
  supervisor_ids bigint[] not null default '{}',
  scope_sig text generated always as (
    md5(
      app.payroll_ids_signature(site_ids)
      || '||'
      || app.payroll_ids_signature(contractor_ids)
      || '||'
      || app.payroll_ids_signature(supervisor_ids)
    )
  ) stored,
  created_at timestamptz not null default now(),
  created_by bigint references public.app_users(id)
);

alter table public.payroll_period_locks
  add column if not exists supervisor_ids bigint[] not null default '{}';

create unique index if not exists payroll_period_locks_scope_uq
  on public.payroll_period_locks (period_start, period_end, scope_sig);

create or replace function public.is_payroll_scope_locked(
  p_period_start date,
  p_period_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[]
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.payroll_period_locks pl
    where pl.period_start = p_period_start
      and pl.period_end = p_period_end
      and pl.scope_sig = md5(
        app.payroll_ids_signature(coalesce(p_site_ids, '{}'))
        || '||'
        || app.payroll_ids_signature(coalesce(p_contractor_ids, '{}'))
        || '||'
        || app.payroll_ids_signature(coalesce(p_supervisor_ids, '{}'))
      )
  );
$$;

drop function if exists public.upsert_payroll_manual_deduction(bigint, date, date, numeric);

create or replace function public.upsert_payroll_manual_deduction(
  p_worker_id bigint,
  p_period_start date,
  p_period_end date,
  p_amount_sar numeric,
  p_filter_site_ids bigint[] default null,
  p_filter_contractor_ids bigint[] default null,
  p_filter_supervisor_ids bigint[] default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_payroll_scope_locked(
    p_period_start,
    p_period_end,
    coalesce(p_filter_site_ids, '{}'),
    coalesce(p_filter_contractor_ids, '{}'),
    coalesce(p_filter_supervisor_ids, '{}')
  ) then
    raise exception 'PAYROLL_LOCKED';
  end if;

  insert into public.payroll_manual_deductions (worker_id, period_start, period_end, amount_sar, updated_at)
  values (p_worker_id, p_period_start, p_period_end, coalesce(p_amount_sar, 0), now())
  on conflict (worker_id, period_start, period_end)
  do update set
    amount_sar = excluded.amount_sar,
    updated_at = now();
end;
$$;

create or replace function public.approve_payroll_period(
  p_period_start date,
  p_period_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_created_by bigint
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_s bigint[] := app.normalize_bigint_ids(coalesce(p_site_ids, '{}'));
  v_c bigint[] := app.normalize_bigint_ids(coalesce(p_contractor_ids, '{}'));
  v_u bigint[] := app.normalize_bigint_ids(coalesce(p_supervisor_ids, '{}'));
  v_sig text := md5(
    app.payroll_ids_signature(v_s)
    || '||'
    || app.payroll_ids_signature(v_c)
    || '||'
    || app.payroll_ids_signature(v_u)
  );
begin
  if exists (
    select 1
    from public.payroll_period_locks pl
    where pl.period_start = p_period_start
      and pl.period_end = p_period_end
      and pl.scope_sig = v_sig
  ) then
    return;
  end if;

  insert into public.payroll_period_locks (period_start, period_end, site_ids, contractor_ids, supervisor_ids, created_by)
  values (p_period_start, p_period_end, v_s, v_c, v_u, p_created_by);
end;
$$;

create or replace function public.unlock_payroll_period(
  p_period_start date,
  p_period_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sig text := md5(
    app.payroll_ids_signature(coalesce(p_site_ids, '{}'))
    || '||'
    || app.payroll_ids_signature(coalesce(p_contractor_ids, '{}'))
    || '||'
    || app.payroll_ids_signature(coalesce(p_supervisor_ids, '{}'))
  );
begin
  delete from public.payroll_period_locks pl
  where pl.period_start = p_period_start
    and pl.period_end = p_period_end
    and pl.scope_sig = v_sig;
end;
$$;

grant execute on function public.upsert_payroll_manual_deduction (bigint, date, date, numeric, bigint[], bigint[], bigint[]) to service_role;
grant execute on function public.is_payroll_scope_locked (date, date, bigint[], bigint[], bigint[]) to service_role;
grant execute on function public.approve_payroll_period (date, date, bigint[], bigint[], bigint[], bigint) to service_role;
grant execute on function public.unlock_payroll_period (date, date, bigint[], bigint[], bigint[]) to service_role;

-- ============== Shared filter helpers (nullable empty array = no filter) ==============
-- p_ids null OR empty → match all rows for that dimension

-- ============== Live search for filter chips (server-side) ==============
create or replace function public.search_report_entities(
  p_kind text,
  p_query text,
  p_limit integer default 40
)
returns table(id bigint, name text, subtitle text)
language sql
stable
security definer
set search_path = public
as $$
  select * from (
    select
      s.id,
      s.name::text as name,
      'موقع'::text as subtitle
    from public.sites s
    where p_kind = 'site'
      and s.is_active = true
      and (
        coalesce(trim(p_query), '') = ''
        or s.name ilike '%' || trim(p_query) || '%'
      )
    union all
    select
      c.id,
      c.name::text,
      'مقاول'::text
    from public.contractors c
    where p_kind = 'contractor'
      and c.is_active = true
      and (
        coalesce(trim(p_query), '') = ''
        or c.name ilike '%' || trim(p_query) || '%'
      )
    union all
    select
      u.id,
      u.full_name::text,
      coalesce(u.username::text, '') as subtitle
    from public.app_users u
    where p_kind = 'supervisor'
      and u.is_active = true
      and (
        coalesce(trim(p_query), '') = ''
        or u.full_name ilike '%' || trim(p_query) || '%'
        or u.username ilike '%' || trim(p_query) || '%'
      )
  ) t
  order by name asc
  limit greatest(1, least(coalesce(p_limit, 40), 200));
$$;

-- ============== Attendance log (daily summary rows) ==============
create or replace function public.get_attendance_log_report_page(
  p_date_start date,
  p_date_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_status text,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(
  worker_id bigint,
  work_date date,
  worker_name text,
  id_number text,
  site_name text,
  contractor_name text,
  supervisor_name text,
  final_status text,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      ads.worker_id as wid,
      ads.work_date as wd,
      w.name as wn,
      w.id_number as win,
      coalesce(sn.name, 'غير محدد') as sname,
      coalesce(cn.name, 'غير محدد') as cname,
      coalesce(sup.full_name, '—') as supname,
      ads.final_status::text as fst
    from public.attendance_daily_summary ads
    join public.workers w on w.id = ads.worker_id
    left join public.sites sn on sn.id = w.current_site_id
    left join public.contractors cn on cn.id = w.contractor_id
    left join public.app_users sup on sup.id = w.assigned_supervisor_id
    where ads.work_date between p_date_start and p_date_end
      and (
        p_site_ids is null
        or cardinality(p_site_ids) = 0
        or w.current_site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null
        or cardinality(p_contractor_ids) = 0
        or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (
          w.assigned_supervisor_id is not null
          and w.assigned_supervisor_id = any(p_supervisor_ids)
        )
      )
      and (
        p_status is null
        or p_status = ''
        or ads.final_status::text = p_status
      )
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or w.current_site_id = any(app.current_user_site_ids())
      )
  ),
  numbered as (
    select
      b.*,
      count(*) over ()::bigint as tc
    from base b
  ),
  paged as (
    select * from numbered
    order by wd desc, wn asc
    offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 1000)))
    limit greatest(1, least(p_page_size, 1000))
  )
  select
    p.wid as worker_id,
    p.wd as work_date,
    p.wn as worker_name,
    p.win as id_number,
    p.sname as site_name,
    p.cname as contractor_name,
    p.supname as supervisor_name,
    p.fst as final_status,
    p.tc as total_count
  from paged p;
$$;

-- ============== Payroll v2 (multi filters) + يومية + خصومات مخالفات + خصومات يدوية ==============
drop function if exists public.get_payroll_report_page_v2(date, date, bigint[], bigint[], bigint[], smallint, integer, integer);
drop function if exists public.get_payroll_report_page_v2(date, date, bigint[], bigint[], bigint[], smallint, integer, integer, text);

create or replace function public.get_payroll_report_page_v2(
  p_date_start date,
  p_date_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_shift_round smallint,
  p_page integer default 1,
  p_page_size integer default 50,
  p_search text default null
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  contractor_name text,
  supervisor_name text,
  payment_type text,
  work_daily_rate_sar numeric,
  daily_rate_sar numeric,
  monthly_basis_sar numeric,
  paid_day_equivalent numeric,
  gross_sar numeric,
  violation_deductions_sar numeric,
  manual_deductions_sar numeric,
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
      coalesce(sup.full_name, '—') as supname,
      coalesce(w.payment_type, 'salary') as ptype,
      coalesce(w.basic_salary, 0)::numeric(12, 2) as basic,
      case
        when coalesce(w.payment_type, 'salary') = 'daily' then coalesce(w.basic_salary, 0)::numeric(12, 4)
        else (coalesce(w.basic_salary, 0) / 30.0)::numeric(12, 4)
      end as day_rate_eff
    from public.workers w
    left join public.sites s on s.id = w.current_site_id
    left join public.contractors c on c.id = w.contractor_id
    left join public.app_users sup on sup.id = w.assigned_supervisor_id
    where w.is_active = true
      and w.is_deleted = false
      and (
        p_site_ids is null or cardinality(p_site_ids) = 0 or w.current_site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null or cardinality(p_contractor_ids) = 0 or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (
          w.assigned_supervisor_id is not null
          and w.assigned_supervisor_id = any(p_supervisor_ids)
        )
      )
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
  manual as (
    select
      pmd.worker_id as mid,
      coalesce(pmd.amount_sar, 0)::numeric(12, 2) as msum
    from public.payroll_manual_deductions pmd
    where pmd.period_start = p_date_start
      and pmd.period_end = p_date_end
  ),
  calc as (
    select
      wb.*,
      coalesce(p.paid_days, 0)::numeric(12, 4) as paid_eq,
      (coalesce(p.paid_days, 0) * wb.day_rate_eff)::numeric(12, 2) as gross,
      coalesce(d.dsum, 0)::numeric(12, 2) as ded_viol,
      coalesce(m.msum, 0)::numeric(12, 2) as ded_manual
    from worker_base wb
    left join paid p on p.pid = wb.wid
    left join ded d on d.did = wb.wid
    left join manual m on m.mid = wb.wid
    where coalesce(p.paid_days, 0) > 0 or coalesce(d.dsum, 0) > 0 or coalesce(m.msum, 0) > 0
  ),
  counted as (
    select
      c.*,
      count(*) over ()::bigint as tc
    from calc c
    where
      p_search is null
      or btrim(p_search) = ''
      or c.wname ilike '%' || btrim(p_search) || '%'
      or replace(coalesce(c.wid_number, ''), ' ', '') ilike '%' || replace(btrim(p_search), ' ', '') || '%'
      or c.wid::text ilike '%' || btrim(p_search) || '%'
  )
  select
    counted.wid as worker_id,
    counted.wname as worker_name,
    counted.wid_number as id_number,
    counted.sname as site_name,
    counted.cname as contractor_name,
    counted.supname as supervisor_name,
    counted.ptype as payment_type,
    counted.day_rate_eff::numeric(12, 2) as work_daily_rate_sar,
    case
      when counted.ptype = 'daily' then counted.basic
      else null::numeric(12, 2)
    end as daily_rate_sar,
    case
      when counted.ptype = 'salary' then counted.basic
      else null::numeric(12, 2)
    end as monthly_basis_sar,
    counted.paid_eq as paid_day_equivalent,
    counted.gross as gross_sar,
    counted.ded_viol as violation_deductions_sar,
    counted.ded_manual as manual_deductions_sar,
    (counted.gross - counted.ded_viol - counted.ded_manual)::numeric(12, 2) as net_sar,
    counted.tc as total_count
  from counted
  order by counted.wname
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 1000)))
  limit greatest(1, least(p_page_size, 1000));
$$;

-- Period payroll stats for all workers (for violations linkage)
create or replace function public.get_worker_period_payroll_map(
  p_date_start date,
  p_date_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_shift_round smallint
)
returns table(
  worker_id bigint,
  gross_sar numeric,
  deductions_sar numeric,
  net_sar numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with worker_base as (
    select w.id as wid, coalesce(w.payment_type, 'salary') as ptype, coalesce(w.basic_salary, 0)::numeric(12,2) as basic
    from public.workers w
    where w.is_deleted = false
      and (
        p_site_ids is null or cardinality(p_site_ids) = 0 or w.current_site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null or cardinality(p_contractor_ids) = 0 or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (w.assigned_supervisor_id is not null and w.assigned_supervisor_id = any(p_supervisor_ids))
      )
      and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or w.current_site_id = any(app.current_user_site_ids())
      )
  ),
  paid as (
    select ads.worker_id as pid,
      sum(case ads.final_status when 'present' then 1::numeric when 'half' then 0.5 else 0 end) as paid_days
    from public.attendance_daily_summary ads
    where ads.work_date between p_date_start and p_date_end
    group by ads.worker_id
  ),
  ded as (
    select wv.worker_id as did,
      sum(coalesce(wv.deduction_sar, vt.deduction_sar, 0))::numeric(12,2) as dsum
    from public.worker_violations wv
    join public.violation_types vt on vt.id = wv.violation_type_id
    where wv.status = 'approved'
      and (wv.occurred_at at time zone 'Asia/Riyadh')::date between p_date_start and p_date_end
    group by wv.worker_id
  )
  select
    wb.wid as worker_id,
    case
      when coalesce(p.paid_days,0)=0 then 0::numeric(12,2)
      when wb.ptype = 'daily' then (coalesce(p.paid_days,0)*wb.basic)::numeric(12,2)
      else ((coalesce(p.paid_days,0)/30.0)*wb.basic)::numeric(12,2)
    end as gross_sar,
    coalesce(d.dsum,0)::numeric(12,2) as deductions_sar,
    (
      case
        when coalesce(p.paid_days,0)=0 then 0::numeric(12,2)
        when wb.ptype = 'daily' then (coalesce(p.paid_days,0)*wb.basic)::numeric(12,2)
        else ((coalesce(p.paid_days,0)/30.0)*wb.basic)::numeric(12,2)
      end
      - coalesce(d.dsum,0)
    )::numeric(12,2) as net_sar
  from worker_base wb
  left join paid p on p.pid = wb.wid
  left join ded d on d.did = wb.wid;
$$;

-- ============== Contractor aggregate (مستخلص) ==============
create or replace function public.get_contractor_invoice_summary_page(
  p_date_start date,
  p_date_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_shift_round smallint,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(
  contractor_id bigint,
  contractor_name text,
  workers_count bigint,
  paid_day_equivalent_sum numeric,
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
      w.contractor_id as cid,
      coalesce(c.name, 'غير محدد') as cname,
      coalesce(w.payment_type, 'salary') as ptype,
      coalesce(w.basic_salary, 0)::numeric(12, 2) as basic
    from public.workers w
    left join public.contractors c on c.id = w.contractor_id
    left join public.app_users sup on sup.id = w.assigned_supervisor_id
    where w.is_active = true
      and w.is_deleted = false
      and (
        p_site_ids is null or cardinality(p_site_ids) = 0 or w.current_site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null or cardinality(p_contractor_ids) = 0 or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (w.assigned_supervisor_id is not null and w.assigned_supervisor_id = any(p_supervisor_ids))
      )
      and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or w.current_site_id = any(app.current_user_site_ids())
      )
  ),
  paid as (
    select ads.worker_id as pid,
      sum(case ads.final_status when 'present' then 1::numeric when 'half' then 0.5 else 0 end) as paid_days
    from public.attendance_daily_summary ads
    where ads.work_date between p_date_start and p_date_end
    group by ads.worker_id
  ),
  ded as (
    select wv.worker_id as did,
      sum(coalesce(wv.deduction_sar, vt.deduction_sar, 0))::numeric(12, 2) as dsum
    from public.worker_violations wv
    join public.violation_types vt on vt.id = wv.violation_type_id
    where wv.status = 'approved'
      and (wv.occurred_at at time zone 'Asia/Riyadh')::date between p_date_start and p_date_end
    group by wv.worker_id
  ),
  calc as (
    select
      wb.cid,
      wb.cname,
      wb.wid,
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
  grp as (
    select
      coalesce(calc.cid, -1) as contractor_id,
      max(calc.cname) as contractor_name,
      count(distinct calc.wid)::bigint as workers_count,
      sum(calc.paid_eq) as paid_day_equivalent_sum,
      sum(calc.gross) as gross_sar,
      sum(calc.ded_amt) as deductions_sar,
      sum(calc.gross - calc.ded_amt)::numeric(12, 2) as net_sar
    from calc
    group by coalesce(calc.cid, -1)
  ),
  numbered as (
    select g.*, count(*) over ()::bigint as tc from grp g
  )
  select
    n.contractor_id,
    n.contractor_name,
    n.workers_count,
    n.paid_day_equivalent_sum,
    n.gross_sar,
    n.deductions_sar,
    n.net_sar,
    n.tc as total_count
  from numbered n
  order by n.net_sar desc
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 1000)))
  limit greatest(1, least(p_page_size, 1000));
$$;

-- تفاصيل مخالفات معتمدة تُحتسب في خصومات المقاول (نفس فلاتر مستخلص المقاولين)
create or replace function public.get_contractor_invoice_violation_lines(
  p_date_start date,
  p_date_end date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_shift_round smallint
)
returns table(
  contractor_id bigint,
  contractor_name text,
  worker_id bigint,
  worker_name text,
  violation_id bigint,
  violation_type_name text,
  deduction_sar numeric,
  occurred_at timestamptz,
  description text
)
language sql
stable
security definer
set search_path = public
as $$
  with worker_allowed as (
    select w.id as wid
    from public.workers w
    where w.is_active = true
      and w.is_deleted = false
      and (
        p_site_ids is null or cardinality(p_site_ids) = 0 or w.current_site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null or cardinality(p_contractor_ids) = 0 or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (w.assigned_supervisor_id is not null and w.assigned_supervisor_id = any(p_supervisor_ids))
      )
      and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or w.current_site_id = any(app.current_user_site_ids())
      )
  )
  select
    w.contractor_id,
    coalesce(c.name, 'غير محدد')::text as contractor_name,
    wv.worker_id,
    w.name::text as worker_name,
    wv.id as violation_id,
    coalesce(vt.name_ar, '—')::text as violation_type_name,
    coalesce(wv.deduction_sar, vt.deduction_sar, 0)::numeric(12, 2) as deduction_sar,
    wv.occurred_at,
    wv.description
  from public.worker_violations wv
  join public.workers w on w.id = wv.worker_id
  join public.violation_types vt on vt.id = wv.violation_type_id
  left join public.contractors c on c.id = w.contractor_id
  where wv.status = 'approved'
    and (wv.occurred_at at time zone 'Asia/Riyadh')::date between p_date_start and p_date_end
    and w.id in (select wa.wid from worker_allowed wa)
  order by contractor_name, worker_name, wv.occurred_at, wv.id;
$$;

-- ============== Violations detail + payroll period columns ==============
create or replace function public.get_violations_report_page_v2(
  p_date_from date,
  p_date_to date,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_status text,
  p_shift_round smallint,
  p_page integer default 1,
  p_page_size integer default 50
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
  deduction_this_sar numeric,
  period_gross_sar numeric,
  period_deductions_sar numeric,
  period_net_sar numeric,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with pm as (
    select * from public.get_worker_period_payroll_map(
      p_date_from,
      p_date_to,
      p_site_ids,
      p_contractor_ids,
      p_supervisor_ids,
      p_shift_round
    )
  ),
  base as (
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
      coalesce(wv.deduction_sar, vt.deduction_sar, 0)::numeric(12, 2) as dthis,
      pm.gross_sar as pgross,
      pm.deductions_sar as pded,
      pm.net_sar as pnet
    from public.worker_violations wv
    join public.workers w on w.id = wv.worker_id
    join public.sites s on s.id = wv.site_id
    join public.violation_types vt on vt.id = wv.violation_type_id
    left join pm on pm.worker_id = wv.worker_id
    where (
        p_site_ids is null or cardinality(p_site_ids) = 0 or wv.site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null
        or cardinality(p_contractor_ids) = 0
        or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (
          w.assigned_supervisor_id is not null
          and w.assigned_supervisor_id = any(p_supervisor_ids)
        )
      )
      and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
      and (
        p_status is null
        or p_status = ''
        or wv.status = p_status::public.violation_status
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
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or wv.site_id = any(app.current_user_site_ids())
      )
  ),
  numbered as (
    select b.*, count(*) over ()::bigint as tc from base b
  )
  select
    n.vid as id,
    n.v_worker_id as worker_id,
    n.v_site_id as site_id,
    n.description,
    n.v_status as status,
    n.occurred_at,
    n.wn as worker_name,
    n.win as worker_id_number,
    n.sn as site_name,
    n.vtn as violation_type_name,
    n.dthis as deduction_this_sar,
    coalesce(n.pgross, 0)::numeric(12, 2) as period_gross_sar,
    coalesce(n.pded, 0)::numeric(12, 2) as period_deductions_sar,
    coalesce(n.pnet, 0)::numeric(12, 2) as period_net_sar,
    n.tc as total_count
  from numbered n
  order by n.occurred_at desc
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 1000)))
  limit greatest(1, least(p_page_size, 1000));
$$;

-- ============== Workers master data ==============
create or replace function public.get_workers_master_report_page(
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_status text,
  p_q text,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(
  id bigint,
  name text,
  id_number text,
  job_title text,
  payment_type text,
  basic_salary numeric,
  site_name text,
  contractor_name text,
  supervisor_name text,
  shift_round smallint,
  iqama_expiry date,
  is_active boolean,
  is_deleted boolean,
  total_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      w.id as wid,
      w.name as wn,
      w.id_number as ein,
      w.job_title as jt,
      coalesce(w.payment_type, 'salary')::text as pt,
      coalesce(w.basic_salary, 0)::numeric(12, 2) as bs,
      coalesce(sn.name, 'غير محدد') as sname,
      coalesce(cn.name, 'غير محدد') as cname,
      coalesce(sup.full_name, '—') as supname,
      w.shift_round as sr,
      w.iqama_expiry as iqd,
      w.is_active as ia,
      w.is_deleted as idl
    from public.workers w
    left join public.sites sn on sn.id = w.current_site_id
    left join public.contractors cn on cn.id = w.contractor_id
    left join public.app_users sup on sup.id = w.assigned_supervisor_id
    where (
        p_site_ids is null or cardinality(p_site_ids) = 0 or w.current_site_id = any(p_site_ids)
      )
      and (
        p_contractor_ids is null
        or cardinality(p_contractor_ids) = 0
        or w.contractor_id = any(p_contractor_ids)
      )
      and (
        p_supervisor_ids is null
        or cardinality(p_supervisor_ids) = 0
        or (
          w.assigned_supervisor_id is not null
          and w.assigned_supervisor_id = any(p_supervisor_ids)
        )
      )
      and (
        p_status is null
        or p_status = ''
        or p_status = 'all'
        or (p_status = 'active' and w.is_active = true and w.is_deleted = false)
        or (p_status = 'inactive' and (w.is_active = false or w.is_deleted = true))
      )
      and (
        coalesce(trim(p_q), '') = ''
        or w.name ilike '%' || trim(p_q) || '%'
        or w.id_number ilike '%' || trim(p_q) || '%'
      )
      and (
        auth.role() = 'service_role'
        or app.is_admin_or_hr()
        or w.current_site_id = any(app.current_user_site_ids())
      )
  ),
  numbered as (
    select b.*, count(*) over ()::bigint as tc from base b
  )
  select
    n.wid as id,
    n.wn as name,
    n.ein as id_number,
    n.jt as job_title,
    n.pt as payment_type,
    n.bs as basic_salary,
    n.sname as site_name,
    n.cname as contractor_name,
    n.supname as supervisor_name,
    n.sr as shift_round,
    n.iqd as iqama_expiry,
    n.ia as is_active,
    n.idl as is_deleted,
    n.tc as total_count
  from numbered n
  order by n.wn asc
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 1000)))
  limit greatest(1, least(p_page_size, 1000));
$$;

-- ============== Monthly matrix + pagination (multi filters) ==============
-- Return type changed (e.g. contractor_name): must DROP first — CREATE OR REPLACE cannot alter OUT row type.
drop function if exists public.get_monthly_attendance_matrix_page_v2(integer, integer, bigint[], bigint[], bigint[], smallint, integer, integer);
drop function if exists app.get_monthly_attendance_matrix_arrays(integer, integer, bigint[], bigint[], bigint[], smallint);

create or replace function app.get_monthly_attendance_matrix_arrays(
  p_year integer,
  p_month integer,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_shift_round smallint
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  contractor_name text,
  d01 text, d02 text, d03 text, d04 text, d05 text, d06 text, d07 text, d08 text, d09 text, d10 text,
  d11 text, d12 text, d13 text, d14 text, d15 text, d16 text, d17 text, d18 text, d19 text, d20 text,
  d21 text, d22 text, d23 text, d24 text, d25 text, d26 text, d27 text, d28 text, d29 text, d30 text, d31 text,
  present_days numeric(8,2),
  absent_days numeric(8,2),
  half_days numeric(8,2),
  attendance_day_equivalent numeric(8,2)
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
    s.name as site_name,
    cn.name as contractor_name
  from public.workers w
  left join public.sites s on s.id = w.current_site_id
  left join public.contractors cn on cn.id = w.contractor_id
  where w.is_active = true
    and w.is_deleted = false
    and (p_site_ids is null or cardinality(p_site_ids) = 0 or w.current_site_id = any(p_site_ids))
    and (p_contractor_ids is null or cardinality(p_contractor_ids) = 0 or w.contractor_id = any(p_contractor_ids))
    and (
      p_supervisor_ids is null
      or cardinality(p_supervisor_ids) = 0
      or (w.assigned_supervisor_id is not null and w.assigned_supervisor_id = any(p_supervisor_ids))
    )
    and (p_shift_round is null or w.shift_round is null or w.shift_round = p_shift_round)
    and (
      auth.role() = 'service_role'
      or app.is_admin_or_hr()
      or w.current_site_id = any(app.current_user_site_ids())
    )
),
day_status as (
  select
    ads.worker_id,
    ads.work_date,
    ads.final_status
  from public.attendance_daily_summary ads
  join bounds b on ads.work_date between b.d_start and b.d_end
),
worker_day_stats as (
  select
    ds.worker_id as wid,
    sum(case when ds.final_status = 'present' then 1 else 0 end)::numeric(8, 2) as present_days,
    sum(case when ds.final_status = 'absent' then 1 else 0 end)::numeric(8, 2) as absent_days,
    sum(case when ds.final_status = 'half' then 1 else 0 end)::numeric(8, 2) as half_days,
    sum(
      case ds.final_status
        when 'present' then 1::numeric
        when 'half' then 0.5::numeric
        else 0::numeric
      end
    )::numeric(8, 2) as attendance_day_equivalent
  from day_status ds
  group by ds.worker_id
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
    end as mark
  from public.attendance_daily_summary ads
  join bounds b on ads.work_date between b.d_start and b.d_end
)
select
  bw.id as worker_id,
  bw.worker_name,
  bw.id_number,
  bw.site_name,
  bw.contractor_name,
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
  coalesce(max(wds.present_days), 0)::numeric(8, 2) as present_days,
  coalesce(max(wds.absent_days), 0)::numeric(8, 2) as absent_days,
  coalesce(max(wds.half_days), 0)::numeric(8, 2) as half_days,
  coalesce(max(wds.attendance_day_equivalent), 0)::numeric(8, 2) as attendance_day_equivalent
from base_workers bw
left join agg on agg.worker_id = bw.id
left join worker_day_stats wds on wds.wid = bw.id
group by bw.id, bw.worker_name, bw.id_number, bw.site_name, bw.contractor_name
order by bw.worker_name;
$$;

create or replace function public.get_monthly_attendance_matrix_page_v2(
  p_year integer,
  p_month integer,
  p_site_ids bigint[],
  p_contractor_ids bigint[],
  p_supervisor_ids bigint[],
  p_shift_round smallint,
  p_page integer default 1,
  p_page_size integer default 50
)
returns table(
  worker_id bigint,
  worker_name text,
  id_number text,
  site_name text,
  contractor_name text,
  d01 text, d02 text, d03 text, d04 text, d05 text, d06 text, d07 text, d08 text, d09 text, d10 text,
  d11 text, d12 text, d13 text, d14 text, d15 text, d16 text, d17 text, d18 text, d19 text, d20 text,
  d21 text, d22 text, d23 text, d24 text, d25 text, d26 text, d27 text, d28 text, d29 text, d30 text, d31 text,
  present_days numeric(8,2),
  absent_days numeric(8,2),
  half_days numeric(8,2),
  attendance_day_equivalent numeric(8,2),
  total_workers bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with matrix as (
    select * from app.get_monthly_attendance_matrix_arrays(
      p_year, p_month, p_site_ids, p_contractor_ids, p_supervisor_ids, p_shift_round
    )
  ),
  numbered as (
    select m.*, count(*) over ()::bigint as total_workers from matrix m
  )
  select *
  from numbered
  order by worker_name
  offset greatest(0, (greatest(1, p_page) - 1) * greatest(1, least(p_page_size, 1000)))
  limit greatest(1, least(p_page_size, 1000));
$$;

grant execute on function public.search_report_entities(text, text, integer) to service_role;
grant execute on function public.get_attendance_log_report_page(date, date, bigint[], bigint[], bigint[], text, integer, integer) to service_role;
grant execute on function public.get_payroll_report_page_v2(date, date, bigint[], bigint[], bigint[], smallint, integer, integer, text) to service_role;
grant execute on function public.get_worker_period_payroll_map(date, date, bigint[], bigint[], bigint[], smallint) to service_role;
grant execute on function public.get_contractor_invoice_summary_page(date, date, bigint[], bigint[], bigint[], smallint, integer, integer) to service_role;
grant execute on function public.get_contractor_invoice_violation_lines(date, date, bigint[], bigint[], bigint[], smallint) to service_role;
grant execute on function public.get_violations_report_page_v2(date, date, bigint[], bigint[], bigint[], text, smallint, integer, integer) to service_role;
grant execute on function public.get_workers_master_report_page(bigint[], bigint[], bigint[], text, text, integer, integer) to service_role;
grant execute on function public.get_monthly_attendance_matrix_page_v2(integer, integer, bigint[], bigint[], bigint[], smallint, integer, integer) to service_role;

commit;

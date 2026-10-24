-- مراجعة أمنية مقترحة — لا تُنفَّذ على الإنتاج دون موافقة.
-- الهدف: تضييق الكتابة على جداول حساسة مع الإبقاء على صلاحيات التطبيق الحالية.
-- يعتمد على app.has_granular_permission و app.can_access_site الموجودتين مسبقاً.

begin;

-- payroll_manual_deductions: قراءة/كتابة لمن يملك تقارير الرواتب أو صلاحية واسعة فقط.
do $$
begin
  if to_regclass('public.payroll_manual_deductions') is null then
    raise notice 'payroll_manual_deductions missing — skip';
  else
    execute 'alter table public.payroll_manual_deductions enable row level security';
    execute 'drop policy if exists payroll_manual_deductions_read on public.payroll_manual_deductions';
    execute $p$
      create policy payroll_manual_deductions_read on public.payroll_manual_deductions
      for select using (
        app.has_granular_permission('*')
        or app.has_granular_permission('report_payroll')
        or app.has_granular_permission('export_reports')
      )
    $p$;
    execute 'drop policy if exists payroll_manual_deductions_write on public.payroll_manual_deductions';
    execute $p$
      create policy payroll_manual_deductions_write on public.payroll_manual_deductions
      for all using (
        app.has_granular_permission('*')
        or app.has_granular_permission('report_payroll')
      ) with check (
        app.has_granular_permission('*')
        or app.has_granular_permission('report_payroll')
      )
    $p$;
  end if;
end $$;

do $$
begin
  if to_regclass('public.payroll_period_locks') is null then
    raise notice 'payroll_period_locks missing — skip';
  else
    execute 'alter table public.payroll_period_locks enable row level security';
    execute 'drop policy if exists payroll_period_locks_read on public.payroll_period_locks';
    execute $p$
      create policy payroll_period_locks_read on public.payroll_period_locks
      for select using (
        app.has_granular_permission('*')
        or app.has_granular_permission('report_payroll')
      )
    $p$;
    execute 'drop policy if exists payroll_period_locks_write on public.payroll_period_locks';
    execute $p$
      create policy payroll_period_locks_write on public.payroll_period_locks
      for all using (app.has_granular_permission('*'))
      with check (app.has_granular_permission('*'))
    $p$;
  end if;
end $$;

-- app_user_sites: المستخدم يرى صفوفه فقط؛ الإدارة تدير الربط.
do $$
begin
  if to_regclass('public.app_user_sites') is null then
    raise notice 'app_user_sites missing — skip';
  else
    execute 'alter table public.app_user_sites enable row level security';
    execute 'drop policy if exists app_user_sites_self_read on public.app_user_sites';
    execute $p$
      create policy app_user_sites_self_read on public.app_user_sites
      for select using (
        app.has_granular_permission('*')
        or app.has_granular_permission('manage_users')
        or app_user_id = app.current_user_id()
      )
    $p$;
  end if;
end $$;

commit;

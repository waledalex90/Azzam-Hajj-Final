-- كود الموظف (فريد): شغّل في SQL Editor بعد النسخ الاحتياطي
begin;

alter table public.workers add column if not exists employee_code text;

comment on column public.workers.employee_code is 'كود الموظف — فريد عند التعبئة؛ يُدخل يدوياً أو من Excel';

drop index if exists idx_workers_employee_code_unique;
create unique index idx_workers_employee_code_unique
  on public.workers ((btrim(employee_code)))
  where employee_code is not null and btrim(employee_code) <> '';

commit;

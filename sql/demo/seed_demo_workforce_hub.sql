-- بيانات وهمية عامة لـ Workforce Hub.
-- للتشغيل على مشروع Supabase تجريبي منفصل فقط.

begin;

insert into public.sites (name)
select x
from (values ('موقع الشمال'), ('موقع الوسط'), ('موقع الجنوب')) as v(x)
where not exists (select 1 from public.sites s where s.name = v.x);

insert into public.contractors (name)
select x
from (values ('مقاول الأفق'), ('مقاول النور')) as v(x)
where not exists (select 1 from public.contractors c where c.name = v.x);

insert into public.workers (name, id_number, employee_code, job_title, payment_type, basic_salary, is_active, is_deleted, current_site_id, contractor_id, shift_round)
select
  w.name,
  w.id_number,
  w.employee_code,
  w.job_title,
  w.payment_type,
  w.basic_salary,
  true,
  false,
  (select id from public.sites order by id limit 1),
  (select id from public.contractors order by id limit 1),
  w.shift_round
from (
  values
    ('عامل تجريبي 1', 'DEMO100001', 'EMP-D001', 'عامل', 'salary', 3000, 1),
    ('عامل تجريبي 2', 'DEMO100002', 'EMP-D002', 'مشغل', 'salary', 3200, 1),
    ('عامل تجريبي 3', 'DEMO100003', 'EMP-D003', 'سائق', 'daily', 180, 2),
    ('عامل تجريبي 4', 'DEMO100004', 'EMP-D004', 'حارس', 'salary', 2800, 2),
    ('عامل تجريبي 5', 'DEMO100005', 'EMP-D005', 'فني', 'salary', 3500, 1)
) as w(name, id_number, employee_code, job_title, payment_type, basic_salary, shift_round)
where not exists (select 1 from public.workers x where x.employee_code = w.employee_code);

commit;

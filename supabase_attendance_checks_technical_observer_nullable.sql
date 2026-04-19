-- التحضير من المراقب الميداني يُخزَّن technical_observer_id = null (انظر submit_attendance_bulk_checks).
-- العمود كان NOT NULL في الإصدارات الأولى → خطأ 23502 عند الإدراج.
-- نفّذ في Supabase SQL Editor مرة واحدة.

alter table public.attendance_checks
  alter column technical_observer_id drop not null;

comment on column public.attendance_checks.technical_observer_id is
  'يُملأ عند تحضير المراقب الفني؛ يبقى null عند التحضير من المراقب الميداني حتى الاعتماد إن لزم.';

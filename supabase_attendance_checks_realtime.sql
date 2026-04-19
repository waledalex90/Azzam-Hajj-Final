-- تفعيل Realtime لجدول attendance_checks حتى يعمل AttendanceSyncBridge (postgres_changes).
-- نفّذ مرة واحدة في Supabase SQL Editor.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'attendance_checks'
  ) then
    alter publication supabase_realtime add table public.attendance_checks;
  end if;
end $$;

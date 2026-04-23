-- public.submit_attendance_bulk_checks (3 معاملات) → ينادي app برباعي مع وردية=1
-- مُدمَج عادة في supabase_migration_app_users_role_to_text.sql وsupabase_azzam_hajj_bootstrap.sql
-- انظر supabase_exec_order.sql

create or replace function public.submit_attendance_bulk_checks(
  p_work_date date,
  p_payload jsonb,
  p_notes text default null
)
returns table(inserted_count integer, updated_count integer)
language sql
security definer
set search_path = public
as $$
  select * from app.submit_attendance_bulk_checks(p_work_date, p_payload, p_notes, 1);
$$;

grant execute on function public.submit_attendance_bulk_checks(date, jsonb, text)
to anon, authenticated, service_role;

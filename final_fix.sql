-- Final fix: expose bulk attendance RPC from public schema
-- Run this in Supabase SQL Editor on the production project.

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
  select * from app.submit_attendance_bulk_checks(p_work_date, p_payload, p_notes);
$$;

grant execute on function public.submit_attendance_bulk_checks(date, jsonb, text)
to anon, authenticated, service_role;

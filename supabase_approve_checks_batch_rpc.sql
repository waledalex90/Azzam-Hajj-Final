-- دفعات اعتماد/رفض: تحديث confirmation_status فقط (بدون is_approved) لتفادي PGRST204 إن كان العمود غير منشور.
-- القيم تُرسَل كـ text ثم تُحوَّل صراحةً إلى نوع الـ enum لتفادي 42804.
-- بعد أي تعديل على الأعمدة: من لوحة Supabase → Settings → API → Reload schema (أو إعادة نشر المشروع).
create or replace function public.approve_attendance_checks_batch(
  p_check_ids bigint[],
  p_confirm boolean
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
  len int;
begin
  if p_check_ids is null then
    return 0;
  end if;
  len := array_length(p_check_ids, 1);
  if len is null or len = 0 then
    return 0;
  end if;
  if len > 500 then
    raise exception 'approve_attendance_checks_batch: max 500 ids per call';
  end if;

  update public.attendance_checks as ac
  set
    confirmation_status = (
      case when p_confirm
        then 'confirmed'
        else 'rejected'
      end
    )::confirmation_status,
    confirmed_at = timezone('utc', now())
  where ac.id = any (p_check_ids)
    and ac.confirmation_status = 'pending'::confirmation_status;

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.approve_attendance_checks_batch(bigint[], boolean) is
  'اعتماد/رفض دفعة (حد 500) — enum confirmation_status بقيم مصبوبة صراحةً.';

revoke all on function public.approve_attendance_checks_batch(bigint[], boolean) from public;
grant execute on function public.approve_attendance_checks_batch(bigint[], boolean) to service_role;

create or replace function public.approve_attendance_bulk_checks(
  p_check_ids bigint[],
  p_confirm boolean
)
returns integer
language sql
security definer
set search_path = public
as $$
  select public.approve_attendance_checks_batch(p_check_ids, p_confirm);
$$;

comment on function public.approve_attendance_bulk_checks(bigint[], boolean) is
  'Alias لـ approve_attendance_checks_batch.';

revoke all on function public.approve_attendance_bulk_checks(bigint[], boolean) from public;
grant execute on function public.approve_attendance_bulk_checks(bigint[], boolean) to service_role;

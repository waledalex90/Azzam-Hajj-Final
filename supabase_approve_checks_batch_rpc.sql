-- دفعات اعتماد/رفض: UPDATE واحد بـ WHERE id = ANY(...) و confirmation_status = 'pending' فقط.
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
    confirmation_status = case when p_confirm then 'confirmed' else 'rejected' end,
    confirmed_at = timezone('utc', now()),
    is_approved = p_confirm
  where ac.id = any (p_check_ids)
    and ac.confirmation_status = 'pending';

  get diagnostics n = row_count;
  return n;
end;
$$;

comment on function public.approve_attendance_checks_batch(bigint[], boolean) is
  'اعتماد أو رفض دفعة سجلات attendance_checks (حد أقصى 500) — السجلات غير المعلّقة تُتخطّى.';

revoke all on function public.approve_attendance_checks_batch(bigint[], boolean) from public;
grant execute on function public.approve_attendance_checks_batch(bigint[], boolean) to service_role;

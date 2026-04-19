-- تشخيص: عمال نشطون بلا موقع حالي — التحضير الجماعي يتجاهلهم (انظر submit_attendance_bulk_checks.scoped_workers).
-- نفّذ في SQL Editor.

select count(*)::bigint as active_workers_without_site
from public.workers
where is_active = true
  and is_deleted = false
  and current_site_id is null;

select id, name, id_number, contractor_id, current_site_id
from public.workers
where is_active = true
  and is_deleted = false
  and current_site_id is null
order by id
limit 200;

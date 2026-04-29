-- ترقية بيانات user_roles **القائمة** لتتوافق مع نموذج الصلاحيات المفتاحي (RBAC v2).
-- نفّذ مرة واحدة في SQL Editor بعد `supabase_azzam_hajj_bootstrap.sql` أو دمج ما يعادل الدوال/البذور.
-- راجِع الصفوف يدوياً إن رغت بيئتك بمفاتيح مخصصة.

update public.user_roles
set permissions = '["*"]'::jsonb
where slug = 'admin';

update public.user_roles
set permissions = '["prep","approval","correction_request","workers_import","users_manage","access_all_sites","transfers"]'::jsonb
where slug = 'hr';

update public.user_roles
set permissions = '["dashboard","prep","approval","correction_request","corrections_screen","workers","sites","reports","violations","violation_notice","access_all_sites","record_attendance_prep","edit_attendance"]'::jsonb
where slug = 'technical_observer';

update public.user_roles
set permissions = '["prep","workers","sites","violations","violation_notice","transfers","attendance_register_as_field","view_attendance","edit_attendance"]'::jsonb
where slug = 'field_observer';

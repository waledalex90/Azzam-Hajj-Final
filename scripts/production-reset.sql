-- =============================================================================
-- production-reset.sql — تفريغ بيانات تشغيلية قبل الإطلاق الفعلي
-- =============================================================================
-- المصدر: أسماء الجداول مُستَقاة من الملفات التالية في المستودع:
--   • ../supabase_azzam_hajj_bootstrap.sql (مجلد الجذر بجانب azzam-hajj-system)
--   • supabase_correction_requests.sql
--   • supabase_user_roles.sql            (جدول مرجعي — لا يُفرَّغ افتراضياً)
--   • supabase_reports_engine_v2.sql
--   • supabase_worker_transfer_requests.sql
--   • supabase_idempotency_patch.sql
--   • supabase_app_users_allowed_sites.sql (أعمدة اختيارية مثل login_email)
--
-- ⚠️  لا يوجد جدول public.users — المستخدمون التطبيقيون في public.app_users،
--     وربط تسجيل الدخول عبر auth.users.id = app_users.auth_user_id (UUID).
--     مخطط auth مُدار من Supabase؛ public.app_users هو مرآة منطقية للصلاحيات والأدوار.
--
-- ⚠️  تحذير: نفّذ فقط بعد نسخة احتياطية كاملة. هذا السكربت يحذف بيانات تشغيلية بكميات كبيرة.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- (أ) استعلامات ما قبل التنفيذ — تحقق من الهوية وتطابق app_users ↔ auth.users
-- -----------------------------------------------------------------------------
-- التسمية:
--   • auth.users     = جدول مصادقة Supabase (المخطط auth)
--   • public.app_users = مستخدمو التطبيق (معرف bigint + auth_user_id → auth.users.id)
-- لا تعارض في الأسماء؛ تأكد فقط من عدم تكرار auth_user_id بين صفّين في app_users.

-- (1) جميع مستخدمو التطبيق وربطهم بـ Auth (راجع عمود auth_user_id)
SELECT
  id              AS app_user_id,
  full_name,
  username,
  role,
  auth_user_id
FROM public.app_users
ORDER BY id;

-- (2) عمود login_email اختياري — يظهر فقط إن طُبّق supabase_app_users_allowed_sites.sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'app_users'
  AND column_name = 'login_email';

-- (3) لا يوجد صفّان في app_users يشيران لنفس auth.users (يجب أن يكون UNIQUE عند عدم NULL)
SELECT auth_user_id, COUNT(*) AS n
FROM public.app_users
WHERE auth_user_id IS NOT NULL
GROUP BY auth_user_id
HAVING COUNT(*) > 1;

-- (4) هويات في auth.users بلا صف مقابل في app_users (مرشّحون للتنظيف لاحقاً يدوياً)
SELECT u.id AS auth_user_id, u.email, u.created_at
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.app_users au WHERE au.auth_user_id = u.id
);

-- (5) attendance_daily_summary: يجب أن يكون جدولاً (TABLE) وليس VIEW لتفريغه بالـ TRUNCATE
SELECT table_type
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'attendance_daily_summary';

-- (6) وجود جدول legacy public.user_sites (مُعرَّف في supabase_azzam_hajj_bootstrap.sql وغيره)
SELECT to_regclass('public.user_sites') IS NOT NULL AS user_sites_exists;

-- (7) بعد التنفيذ ستضبط OWNER — للتحقق المسبق استبدل الرقم:
-- SELECT * FROM public.app_users WHERE id = ___OWNER_APP_USER_ID___;


-- -----------------------------------------------------------------------------
-- (ب) المعاملة الرئيسية — املأ OWNER_APP_USER_ID ثم نفّذ BEGIN…COMMIT
-- -----------------------------------------------------------------------------
-- ╔═══════════════════════════════════════════════════════════════════════════╗
-- ║  OWNER_APP_USER_ID — معرّف صف المالك في public.app_users (bigint فقط)    ║
-- ║  ضع الرقم الحقيقي بدل القيمة في INSERT أدناه قبل التشغيل.                ║
-- ║  هذا السطر هو «قفل الأمان» الوحيد: المستخدم بهذا الـ id يُبقى، الباقي يُحذف. ║
-- ╚═══════════════════════════════════════════════════════════════════════════╝

BEGIN;

DROP TABLE IF EXISTS _owner_ctx;

CREATE TEMP TABLE _owner_ctx (owner_app_user_id bigint PRIMARY KEY);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
--  OWNER: استبدل الرقم 1 بـ public.app_users.id الخاص بالمالك (مثال: 3 أو 42)
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
INSERT INTO _owner_ctx (owner_app_user_id) VALUES (1);
-- <<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<

DO $$
DECLARE
  v_owner bigint;
  v_cnt int;
BEGIN
  SELECT owner_app_user_id INTO v_owner FROM _owner_ctx LIMIT 1;
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'OWNER غير معيّن: غيّر INSERT في _owner_ctx إلى معرف صالح';
  END IF;
  SELECT COUNT(*) INTO v_cnt FROM public.app_users WHERE id = v_owner;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'معرف المالك % غير موجود في app_users', v_owner;
  END IF;
END
$$;

-- مصفوفة المواقع المسموحة: بعد حذف sites يجب أن تكون فارغة للمالك (أدمن غالباً غير مقيّد بالموقع)
UPDATE public.app_users au
SET allowed_site_ids = '{}'::integer[]
WHERE au.id = (SELECT owner_app_user_id FROM _owner_ctx);

-- تفريغ user_sites أولاً إن وُجد (FK إلى sites و app_users — يجب أن يُزال قبل sites)
DO $$
BEGIN
  IF to_regclass('public.user_sites') IS NOT NULL THEN
    EXECUTE 'TRUNCATE TABLE public.user_sites RESTART IDENTITY CASCADE';
  END IF;
END
$$;

-- -----------------------------------------------------------------------------
-- قائمة الجداول المُفرَّغة (أسماء حقيقية من ملفات SQL أعلاه) + RESTART IDENTITY
-- -----------------------------------------------------------------------------
-- إن احتجت مرجعاً للمصدر:
--   supabase_azzam_hajj_bootstrap.sql → contractors, sites, workers, attendance_*,
--     violation_types (مرجعي — مُستثنى), worker_violations, violation_evidence,
--     violation_status_history, user_sites, app_user_sites, app_users (يُحذف جزئياً لاحقاً)
--   supabase_correction_requests.sql → correction_requests
--   supabase_reports_engine_v2.sql → payroll_manual_deductions, payroll_period_locks
--   supabase_worker_transfer_requests.sql → worker_transfer_requests
--   supabase_idempotency_patch.sql → sync_idempotency_keys
--   supabase_user_roles.sql → user_roles (بذور أدوار — لا تُفرَّغ في هذا السكربت)
--
-- ملاحظة: violation_types يُترك (بيانات مرجعية من البذور في bootstrap).
-- RESTART IDENTITY يصفّر تسلسل معرّفات IDENTITY؛ الجداول ذات المفتاح المركّب فقط
-- (مثل user_sites / app_user_sites) يُقصُ منها الصفوف دون تسلسل رقمي.

TRUNCATE TABLE
  public.violation_status_history,
  public.violation_evidence,
  public.correction_requests,
  public.attendance_checks,
  public.attendance_rounds,
  public.attendance_daily_summary,
  public.worker_violations,
  public.worker_transfer_requests,
  public.payroll_manual_deductions,
  public.payroll_period_locks,
  public.app_user_sites,
  public.sync_idempotency_keys,
  public.workers,
  public.contractors,
  public.sites
RESTART IDENTITY CASCADE;

-- حذف كل صفوف app_users ما عدا المالك (لا يمس auth.users — التنظيف من لوحة Auth لاحقاً)
DELETE FROM public.app_users au
WHERE au.id <> (SELECT owner_app_user_id FROM _owner_ctx);

COMMIT;


-- -----------------------------------------------------------------------------
-- (ج) تنظيف auth.users (يدوي — راجع القائمة قبل أي DELETE على auth)
-- -----------------------------------------------------------------------------
-- بعد الخطوة (ب)، قد تبقى صفوف في auth.users لا يُطابقها app_users.auth_user_id.
-- الأسلوب الآمن: Authentication في لوحة Supabase.
-- استعلام مساعد (للمراجعة فقط):
-- SELECT id, email, created_at
-- FROM auth.users
-- WHERE id NOT IN (SELECT auth_user_id FROM public.app_users WHERE auth_user_id IS NOT NULL);


-- -----------------------------------------------------------------------------
-- (د) REINDEX اختياري بعد التفريغ
-- -----------------------------------------------------------------------------
-- REINDEX TABLE public.attendance_checks;
-- REINDEX TABLE public.workers;


-- -----------------------------------------------------------------------------
-- (هـ) استعلامات التأكيد — اقرأ النتائج بعينك بعد التنفيذ
-- -----------------------------------------------------------------------------

-- (1) أعداد الصفوف (يجب أن تكون صفراً للجداول المُفرَّغة)
SELECT 'correction_requests' AS tbl, COUNT(*)::bigint AS n FROM public.correction_requests
UNION ALL SELECT 'attendance_checks', COUNT(*) FROM public.attendance_checks
UNION ALL SELECT 'attendance_rounds', COUNT(*) FROM public.attendance_rounds
UNION ALL SELECT 'attendance_daily_summary', COUNT(*) FROM public.attendance_daily_summary
UNION ALL SELECT 'worker_violations', COUNT(*) FROM public.worker_violations
UNION ALL SELECT 'violation_evidence', COUNT(*) FROM public.violation_evidence
UNION ALL SELECT 'violation_status_history', COUNT(*) FROM public.violation_status_history
UNION ALL SELECT 'worker_transfer_requests', COUNT(*) FROM public.worker_transfer_requests
UNION ALL SELECT 'payroll_manual_deductions', COUNT(*) FROM public.payroll_manual_deductions
UNION ALL SELECT 'payroll_period_locks', COUNT(*) FROM public.payroll_period_locks
UNION ALL SELECT 'app_user_sites', COUNT(*) FROM public.app_user_sites
UNION ALL SELECT 'sync_idempotency_keys', COUNT(*) FROM public.sync_idempotency_keys
UNION ALL SELECT 'workers', COUNT(*) FROM public.workers
UNION ALL SELECT 'contractors', COUNT(*) FROM public.contractors
UNION ALL SELECT 'sites', COUNT(*) FROM public.sites
ORDER BY tbl;

-- (2) user_sites إن وُجد
SELECT CASE WHEN to_regclass('public.user_sites') IS NULL THEN 'user_sites: غير موجود'
       ELSE format('user_sites: %s صف', (SELECT COUNT(*)::text FROM public.user_sites))
       END AS user_sites_status;

-- (3) المالك يظل وحيداً في app_users
SELECT COUNT(*) AS app_users_total FROM public.app_users;

SELECT id, full_name, username, role, auth_user_id, allowed_site_ids
FROM public.app_users;

-- (4) تطابق app_users ↔ auth.users: كل auth_user_id يجب أن يقابل صفاً في auth.users
SELECT
  au.id AS app_user_id,
  au.username,
  au.auth_user_id,
  u.email AS auth_email,
  CASE
    WHEN au.auth_user_id IS NULL THEN 'تنبيه: لا يوجد ربط بمصادقة Supabase'
    WHEN u.id IS NULL THEN 'خطأ: auth_user_id لا يوجد في auth.users'
    ELSE 'موافق'
  END AS app_auth_alignment
FROM public.app_users au
LEFT JOIN auth.users u ON u.id = au.auth_user_id;

-- (5) user_roles ما زال بذوراً (عدد > 0 متوقع إن طُبّق supabase_user_roles.sql)
SELECT COUNT(*)::bigint AS user_roles_rows FROM public.user_roles;

-- (6) violation_types مرجعي (عدد > 0 متوقع إن طُبّق bootstrap)
SELECT COUNT(*)::bigint AS violation_types_rows FROM public.violation_types;

-- (7) RLS ما زال مفعّلاً على جداول رئيسية (التفريغ لا يعطّل السياسات)
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename = ANY (ARRAY[
    'app_users','workers','sites','contractors',
    'attendance_checks','worker_violations','worker_transfer_requests','user_roles'
  ])
ORDER BY tablename;

-- (8) التحقق من إعادة تسلسل الهوية (مثال: أول عامل جديد بعد الإدراج يأخذ id = 1 حيث ينطبق)
-- SELECT last_value FROM pg_sequences WHERE schemaname = 'public' AND sequencename LIKE 'workers%';

-- =============================================================================
-- تدقيق فلاتر قائمة التحضير (مطابقة منطق getAttendanceWorkerIdsForFilters +
-- getAllPendingPrepWorkers دفعة الجلب الثانية) — للتشغيل في SQL Editor بـ Supabase.
--
-- ملاحظة من الكود: صفحة /attendance تستدعي getAllPendingPrepWorkers مع search: دائماً
-- undefined؛ البحث الفوري في الواجهة لا يعيد استدعاء السيرفر (matchesClientSearch فقط).
-- =============================================================================

-- غيّر القيم في params فقط:
WITH params AS (
  SELECT
    123::bigint AS site_id,              -- معرف الموقع (من جدول sites)
    DATE '2026-01-15' AS work_date,      -- نفس تاريخ شاشة التحضير
    1 AS round_no,                       -- 1 = صباحي، 2 = مسائي
    NULL::bigint AS contractor_id        -- أو رقم مقاول إن كان الفلتر مفعّلاً في الرابط
),

-- (1) نطاق «العمال المرشّحين» — نفس شروط مسح workers في getAttendanceWorkerIdsForFilters
--     (بدون استبعاد المُحضَّرين بعد).
base_candidates AS (
  SELECT w.*
  FROM public.workers w
  CROSS JOIN params p
  WHERE w.is_active = true
    AND w.is_deleted = false
    AND w.current_site_id = p.site_id
    AND (p.contractor_id IS NULL OR w.contractor_id = p.contractor_id)
    AND (w.shift_round IS NULL OR w.shift_round = p.round_no)
),

-- (2) معرفات تُستبعد لأن لهم سجل حضور في الجولة/التاريخ (ومسائي يضيف صباحي نفس اليوم)
--     مطابقة getPrepExclusionWorkerIds / getPreppedWorkerIdsForDate لموقع واحد.
excluded_prepped AS (
  SELECT DISTINCT ac.worker_id AS id
  FROM public.attendance_checks ac
  JOIN public.attendance_rounds ar ON ar.id = ac.round_id
  CROSS JOIN params p
  WHERE ar.work_date = p.work_date
    AND ar.site_id = p.site_id
    AND (
      ar.round_no = p.round_no
      OR (p.round_no = 2 AND ar.round_no = 1)
    )
),

-- (3) من يُفترض أن تُعرضهم قائمة «المعلّقين» في التطبيق (نفس مجموعة pendingIds قبل جلب الصفوف).
expected_pending AS (
  SELECT b.*
  FROM base_candidates b
  WHERE NOT EXISTS (
    SELECT 1 FROM excluded_prepped e WHERE e.id = b.id
  )
)

-- ---------------------------------------------------------------------------
-- أ) عرض كل المرشّحين بالموقع مع سبب عدم ظهورهم كـ «معلّق» (إن وُجد)
-- ---------------------------------------------------------------------------
SELECT
  b.id,
  b.name,
  b.employee_code,
  b.id_number,
  b.shift_round,
  b.contractor_id,
  b.current_site_id,
  EXISTS (SELECT 1 FROM excluded_prepped e WHERE e.id = b.id) AS excluded_because_prepped,
  NOT EXISTS (SELECT 1 FROM excluded_prepped e WHERE e.id = b.id) AS should_show_in_prep_list
FROM base_candidates b
ORDER BY b.id;

-- ---------------------------------------------------------------------------
-- ب) من لهم اسم يطابق جزء نصي لكنهم ليسوا ضمن expected_pending (الفجوة مقابل القائمة)
--     غيّر '%جزء_الاسم%' أدناه.
-- ---------------------------------------------------------------------------
-- SELECT b.id, b.name, b.employee_code, b.shift_round,
--        EXISTS (SELECT 1 FROM excluded_prepped e WHERE e.id = b.id) AS has_prep_record
-- FROM base_candidates b
-- WHERE b.name ILIKE '%جزء_الاسم%'
--   AND NOT EXISTS (SELECT 1 FROM expected_pending p WHERE p.id = b.id)
-- ORDER BY b.id;

-- ---------------------------------------------------------------------------
-- ج) عمال بالموقع لهم الاسم لكنهم خارج «المرشّحين» أصلاً (inactive / موقع آخر / وردية أخرى / مقاول)
-- ---------------------------------------------------------------------------
-- SELECT w.id, w.name, w.is_active, w.is_deleted, w.current_site_id, w.shift_round, w.contractor_id
-- FROM public.workers w
-- CROSS JOIN params p
-- WHERE w.current_site_id = p.site_id
--   AND w.name ILIKE '%جزء_الاسم%'
--   AND NOT EXISTS (SELECT 1 FROM base_candidates b WHERE b.id = w.id)
-- ORDER BY w.id;

# Performance Audit — Azzam Hajj (Hot Paths)

**التاريخ:** 2026-04-24  
**البيئة المفحوصة:** الكود المصدري (Next.js App Router + Supabase).  
**ملاحظة:** تشغيل `EXPLAIN (ANALYZE, BUFFERS)` يتطلب اتصالاً بقاعدة بيانات تحمل بيانات حقيقية؛ لم يُنفَّذ هنا تلقائياً. استخدم الاستعلامات المذكورة أدناه على نسخة staging/production عند التحقق.

---

## ملخص تنفيذي — أعلى 3 تحسينات (عائد × مخاطرة)

| # | التحسين | العائد | المخاطرة |
|---|---------|--------|----------|
| 1 | فهرس مركّب على `attendance_rounds(work_date, site_id, round_no)` لمسار مراجعة/قائمة الحضور المفلترة باليوم والموقع والوردية | تقليل تكلفة joins من `attendance_checks` → `attendance_rounds` على البيانات الكبيرة | منخفضة — إضافة فهرس فقط |
| 2 | رفع مرفقات إشعار المقاول **بشكل متوازٍ** (دفعات صغيرة) بدل تسلسل كامل لكل ملف | تقليل زمن إجمالي الرفع متعدد الملفات | منخفضة — نفس الـ storage paths والصلاحيات |
| 3 | (مستقبلي) لفّ استدعاءات `has_granular_permission` في الـ RLS بصيغة **scalar subquery** حيث يناسب Postgres — يُقاس قبل/بعد | تقليل تكرار تقييم الدالة لكل صف في بعض الخطط | متوسطة — يتطلب اختبار سياسات و regression |

---

## جدول المخرجات التفصيلي

| المسار / الدالة / الملف | الملاحظة (ما يُتوقع من EXPLAIN / الكود) | الحل المقترح | المخاطرة | أولوية |
|-------------------------|----------------------------------------|--------------|----------|--------|
| `lib/data/attendance.ts` → `getAttendanceChecksPage` | استعلام PostgREST: `attendance_checks` + `attendance_rounds!inner` بفلاتر `work_date`, `site_id`, `round_no` + اختياري `workers!inner` للبحث | فهرس `idx_att_rounds_date_site_round` (انظر `supabase_performance_hot_path_indexes.sql`). تقليص الـ select موجود جزئياً | منخفضة | عالية |
| `lib/data/attendance.ts` → `getAllPendingPrepWorkers` / `getAttendanceWorkerIdsForFilters` | مسح `workers` على دفعات مع `.or` للوردية؛ فهارس `workers` موجودة في bootstrap | الإبقاء على OFFSET في Phase 1؛ مراقبة تكلفة المسح على بيانات ضخمة | — | متوسطة |
| `lib/services/attendance-engine.ts` → `submitAttendanceByWorkersEngine` | استدعاء RPC واحد `submit_attendance_bulk_checks` — **لا N+1** على التطبيق | لا تغيير؛ التأكد من فهارس `attendance_checks(round_id)` و`attendance_rounds` | — | — |
| `app/(dashboard)/attendance/actions.ts` → `submitAttendancePrepBulk` | Server Action واحد لكل دفعة (حتى 500) | SLO: قيس زمن **Route Handler** الفعلي (Server Action) | — | قياس |
| `lib/data/violations.ts` → `uploadContractorNoticeMediaFiles` | كان **حلقة تسلسلية** `await` لكل ملف = N round-trips لـ Storage | **تنفيذ:** رفع متوازٍ بحد (4) لكل دفعة | منخفضة | عالية |
| `app/(dashboard)/violations/notice/actions.ts` → `saveInfractionNoticeAction` | `getInfractionNoticeOptions()` ثم استعلام `contractors` على التسلسل | **تنفيذ:** `Promise.all` لخيارات الإشعار + المقاول | منخفضة | متوسطة |
| `app/api/reports/export/route.ts` + `lib/reports/queries.ts` | RPCs مثل `get_monthly_attendance_matrix_page_v2` + OFFSET + حجم `EXPORT_CHUNK` | لا Materialized View في هذه الجولة (يتطلب سياسة تحديث). تحسين التجميع داخل `supabase_reports_engine_v2.sql` لاحقاً بقياس | — | متوسطة/طويلة |
| `supabase_azzam_hajj_bootstrap.sql` → `app.has_granular_permission` | **STABLE** + `plpgsql` يقرأ `app_users` + `user_roles` + `jsonb_array_elements_text`. في policies تُستدعى **عدة مرات** في نفس `USING` (OR) | لكل policy: دراسة `(select app.has_granular_permission('x'))` مرة لكل **statement** (حسب إصدار PG). **لم يُغيّر** سلوك RLS في هذا التدقيق | متوسطة عند التطبيق | مستقبلي |
| RLS `worker_violations_read_scoped` إلخ | `has_granular_permission` ×2 + `can_access_site` — تكرار داخل نفس السطر | توحيد فحوصات الصلاحية في دالة مساعدة واحدة (تصميم) أو subquery | متوسطة | مستقبلي |
| `app_users.auth_user_id` | عمود `unique` — فهرس ضمني | لا إجراء | — | — |
| الواجهة: `components/attendance/attendance-workers-table.tsx` | التحضير: نجاح السيرفر ثم `onAttendanceChunkSaved` / `router.refresh` — **ليست** optimistic من تعريفها (الحالة تتحدث بعد الرد) | اختياري مستقبلاً: حالة مؤقتة + rollback عند فشل الـ action | متوسطة | تحسين UX |
| LCP & Bundle | يلزم قياس ميداني (RUM) أو Lighthouse على `/dashboard` و`/attendance` | `next/image` للصور الكبيرة؛ مراجعة `import` الديناميكي للوحات الثقيلة | حسب التغيير | متوسطة |

---

## استعلامات مقترَحة لـ EXPLAIN (تشغيل يدوي على Staging)

```sql
-- مسار شائع: جداول التحقق حسب يوم + موقع (بعد join من checks)
EXPLAIN (ANALYZE, BUFFERS)
SELECT ar.id, ar.work_date, ar.site_id, ar.round_no
FROM public.attendance_rounds ar
WHERE ar.work_date = CURRENT_DATE
  AND ar.site_id = 1
  AND ar.round_no = 1;

-- ملخص شهري (ثقيل) — نفس منطق التقارير
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.get_monthly_attendance_matrix_page_v2(
  2026, 4, NULL, NULL, NULL, NULL, 1, 50
);
```

---

## SLOs (للمراقبة وليس عقداً)

| فئة | الهدف المقترح | ملاحظة |
|-----|----------------|--------|
| تفاعلي (Server Actions / API) | p50 TTFB &lt; 200ms، p95 &lt; 500ms | قياس من البنية المستضافة (مثلاً Vercel) أو `Server-Timing` |
| ثقيل (تقارير RPC / CSV) | p95 منفصل؛ لا تُقاس بنفس عتبة التفاعل | — |

---

## المراجع في المستودع

- فهارس جديدة مقترَحة/مُنفَّذة كملف SQL: `supabase_performance_hot_path_indexes.sql`
- تعديلات كود: `lib/data/violations.ts` (رفع متوازٍ)، `app/(dashboard)/violations/notice/actions.ts` (استعلامات متوازية)

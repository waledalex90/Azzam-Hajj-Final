---
title: "نظام عزام للحج — وثيقة حالة المشروع"
---

# نظام عزام للحج (Azzam Hajj System)  
## وثيقة الحالة — آخر مرحلة معتمدة في الكود

**تاريخ توليد الوثيقة:** 18 أبريل 2026  
**المستودع:** `https://github.com/waledalex90/Azzam-Hajj-Final`  
**الفرع:** `main`  
**آخر كومِت (HEAD):** `c50b16c` — *fix(reports): EXPORT_CHUNK 1000 for PostgREST max_rows (on 131c9ca baseline)*

---

## 1. ملخص المرحلة الحالية

| البند | القيمة |
|--------|--------|
| إطار الواجهة | **Next.js 16.2.3** (App Router، `build` بـ webpack) |
| React | **19.2.4** |
| قاعدة البيانات والـ Auth | **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) |
| PWA | **next-pwa** (تسجيل Service Worker في الإنتاج؛ معطّل في التطوير) |
| الاستضافة المعتمدة للإنتاج | **Vercel** (متغيرات البيئة مطابقة لـ `.env.local` / إعدادات المشروع) |

**خط الأساس الحالي للتقارير:** الكومِت **`131c9ca`** — *feat(reports): Supabase RPC engine, multi-filter hub, CSV export with progress* — مع تعديل لاحق واحد فقط: **`EXPORT_CHUNK = 1000`** في `lib/reports/queries.ts` حتى يتوافق مع حد PostgREST الافتراضي **`max_rows` ≈ 1000** ولا تُقطع دفعات التصدير.

> **ملاحظة:** تم سابقاً تجربة إصدارات لاحقة (تصدير بالبث، تشخيص، تعديلات PWA، ربط CI مع Supabase، إلخ) ثم **التراجع** إلى خط **131c9ca** كأساس مستقر؛ الوثيقة تعكس **ما في الفرع `main` الآن** وليس كل التجارب التاريخية.

---

## 2. الوحدات الوظيفية الرئيسية (لقطات من هيكل `app/`)

- **الرئيسية / لوحة:** `/(dashboard)/dashboard`
- **التحضير:** `attendance` — تحضير فوري، مراجعة يوم، فلاتر، ورديات
- **الموافقات:** `approval`
- **العمال:** `workers` — استيراد Excel على دفعات
- **المواقع / المقاولون / المستخدمون / الأدوار:** `sites`, `contractors`, `users`, `roles`
- **المخالفات:** `violations` (+ إشعار)
- **التصحيحات:** `corrections`
- **النقل:** `transfers`
- **التقارير:** `reports` — محرك تقارير يعتمد على **RPCs** في Supabase، معاينة محدودة، تصدير **CSV** كامل عبر API
- **دخول / دون اتصال:** `login`, `offline`

---

## 3. طبقة التقارير (المرحلة الحالية)

- **الواجهة:** `components/reports/` و`app/(dashboard)/reports/page.tsx`
- **استعلامات الخادم:** `lib/reports/queries.ts`
  - معاينة: `PREVIEW_SIZE = 50`
  - تصدير دُفع: **`EXPORT_CHUNK = 1000`**
- **API:**
  - `GET /api/reports/estimate` — تقدير عدد السجلات للتقدم
  - `GET /api/reports/export` — بث **CSV** UTF-8
- **ملفات SQL مرجعية في جذر المشروع** (تنفَّذ يدوياً في SQL Editor حسب ترتيب التسليم لديكم):  
  أمثلة: `supabase_reports_engine_v2.sql`, `supabase_reports_views_rpc.sql`, `supabase_reports_professional_patch.sql`, وغيرها حسب ما وافقتم عليه مع قاعدة **Azzam Hajj**.

---

## 4. المتغيرات البيئية (إلزامية)

| المتغير | الاستخدام |
|---------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط مشروع Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon (العميل) |
| `SUPABASE_SERVICE_ROLE_KEY` | سيرفر فقط — تقارير، استيراد، عمليات إدارية (لا يُعرض في المتصفح) |

التحقق المحلي: `npm run verify:supabase`

---

## 5. البناء والتشغيل

```bash
npm install
npm run dev          # تطوير
npm run build        # إنتاج
npm start            # بعد build
```

---

## 6. مرجع README

للتفاصيل الإضافية (Excel، ورديات، نقل، Vercel): راجع **`README.md`** في جذر المشروع.

---

*نهاية الوثيقة — توليد آلي من هيكل المستودع عند كومِت `c50b16c`.*

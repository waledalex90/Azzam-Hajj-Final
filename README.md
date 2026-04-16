# Azzam Hajj — النسخة النهائية للإنتاج

مشروع [Next.js](https://nextjs.org) لنظام عزّام (التحضير، العمال، الموافقات، التقارير).

## الميزات المتفق عليها (مرجع للتسليم)

1. **تحضير فوري** (`components/attendance/attendance-workzone.tsx` + `attendance-workers-table.tsx`): عند الضغط (فردي أو جماعي) يُخفى العامل من الجدول محلياً، تُحدَّث العدادات (معلّق / حاضر / غائب / نصف يوم) فوراً، ثم الانتقال لتبويب **مراجعة تحضير اليوم** بعد الحفظ.
2. **استيراد Excel على دفعات 200** مع شريط تقدّم (`components/workers/workers-upload-form.tsx` — `CHUNK_SIZE = 200`)، وتحضير جماعي بنفس حجم الدفعة (`BULK_CHUNK_SIZE = 200` في جدول التحضير).

## المتطلبات البيئية (Supabase — مشروع Azzam Hajj فقط)

1. أنشئ/افتح مشروع **Azzam Hajj** في Supabase (لا تستخدم ref لمشروع آخر).
2. انسخ `.env.example` إلى `.env.local` واملأ القيم من **Settings → API** لنفس المشروع:

| المتغير | الوصف |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (سيرفر/استيراد Excel؛ لا يُعرض للمتصفح) |

3. تأكد أن دالة الحضور الجماعي منشأة في نفس المشروع: نفّذ في **SQL Editor** محتوى `final_fix.sql` ثم **`supabase_shift_round_rpc.sql`** (يضيف وسيط `p_round_no` للوردية صباحي/مسائي = `round_no` 1 و 2). بدون هذا الملف الأخير قد يفشل الحفظ من التطبيق بعد التحديث.
4. **نقل الموظفين (طلبات)**: نفّذ **`supabase_worker_transfer_requests.sql`** لإنشاء `app_user_sites` و`worker_transfer_requests`، ثم اربط كل مراقب ميداني بمواقعه بإدراج صفوف `(app_user_id, site_id)`.
5. اختبار الاتصال محلياً:

```bash
npm run verify:supabase
```

كل الـ APIs و`attendance-engine.ts` تقرأ من `lib/env.ts` — أي أن نفس الثلاثة متغيرات توجه كل البيانات إلى قاعدة Azzam.

## رفع الكود إلى الريبو الجديد `Azzam-Hajj-Final`

المستودع الرسمي للإنتاج: **`https://github.com/waledalex90/Azzam-Hajj-Final`** (يُنشأ مرة واحدة).

### الطريقة أ — سكربت (يحتاج GitHub CLI مسجّل بحساب waledalex90)

```powershell
cd "مسار\azzam-hajj-system"
gh auth login
.\scripts\push-github-final.ps1
```

### الطريقة ب — يدوياً

1. أنشئ على GitHub مستودعاً فارغاً باسم **Azzam-Hajj-Final** (بدون README إن رغبت بدفع نظيف).
2. ثم:

```powershell
git remote add final https://github.com/waledalex90/Azzam-Hajj-Final.git
git push -u final main
```

## Vercel (حساب waledalex90 فقط)

1. سجّل الدخول إلى Vercel بحساب **waledalex90**.
2. **Add New Project** → استورد **`waledalex90/Azzam-Hajj-Final`**.
3. **Settings → Environment Variables**: أضف نفس أسماء المتغيرات أعلاه (Production + Preview إن لزم).
4. **Production Branch**: `main`.
5. بعد أول نشر ناجح (Ready أخضر)، اربط **دومين الإنتاج** الواحد المعتمد للفريق.

---

## التطوير المحلي

```bash
npm install
npm run dev
```

افتح [http://localhost:3000](http://localhost:3000).

# Azzam Hajj — النسخة النهائية للإنتاج

مشروع [Next.js](https://nextjs.org) لنظام عزّام (التحضير، العمال، الموافقات، التقارير).

## الميزات المتفق عليها (مرجع للتسليم)

1. **تحضير فوري** (`components/attendance/attendance-workzone.tsx` + `attendance-workers-table.tsx`): عند الضغط (فردي أو جماعي) يُخفى العامل من الجدول محلياً، تُحدَّث العدادات (معلّق / حاضر / غائب / نصف يوم) فوراً، ثم الانتقال لتبويب **مراجعة تحضير اليوم** بعد الحفظ.
2. **استيراد Excel على دفعات 200** مع شريط تقدّم (`components/workers/workers-upload-form.tsx` — `CHUNK_SIZE = 200`)، وتحضير جماعي بنفس حجم الدفعة (`BULK_CHUNK_SIZE = 200` في جدول التحضير).

## المتطلبات البيئية (Supabase — مشروع Azzam)

انسخ `.env.example` إلى `.env.local` وعبّئ من لوحة Supabase → **Project Settings → API**:

| المتغير | الوصف |
|--------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | رابط المشروع |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | مفتاح anon العام |
| `SUPABASE_SERVICE_ROLE_KEY` | مفتاح service role (سيرفر فقط؛ لا تُعرضه في الواجهة) |

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

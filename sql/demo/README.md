# بيانات العرض (Demo)

هذه البذور لمشروع **Supabase تجريبي منفصل فقط**.

لا تشغّلها على قاعدة الإنتاج.

لتفعيل نسخة العرض بأمان:

1. أنشئ مشروع Supabase جديد فارغ.
2. طبّق مخطط التطبيق (bootstrap) على المشروع التجريبي.
3. شغّل `seed_demo_workforce_hub.sql` هناك.
4. اضبط متغيرات بيئة النسخة التجريبية:
   - `NEXT_PUBLIC_DEMO_MODE=true`
   - `DEMO_MODE=true`
   - `DEMO_ISOLATED=true`
   - مفاتيح URL/anon/service للمشروع التجريبي فقط.

بدون `DEMO_ISOLATED=true` لا تُعتبر النسخة آمنة للعرض العام حتى لو مُنعت الكتابة.

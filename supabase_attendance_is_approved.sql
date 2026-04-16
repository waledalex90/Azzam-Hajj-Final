-- عمود is_approved اختياري — الكود لا يعتمد عليه (يُستمد الاعتماد من confirmation_status).
-- إن أضفت العمود: من Supabase → Settings → API → Reload schema لتفادي PGRST204.

ALTER TABLE public.attendance_checks
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

UPDATE public.attendance_checks
SET is_approved = (confirmation_status = 'confirmed');

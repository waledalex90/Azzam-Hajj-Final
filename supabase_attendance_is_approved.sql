-- عمود is_approved يتماشى مع confirmation_status = 'confirmed' (اعتماد نهائي).
-- نفّذ في Supabase SQL Editor مرة واحدة قبل الاعتماد على التحديثات من الواجهة.

ALTER TABLE public.attendance_checks
  ADD COLUMN IF NOT EXISTS is_approved boolean NOT NULL DEFAULT false;

UPDATE public.attendance_checks
SET is_approved = (confirmation_status = 'confirmed');

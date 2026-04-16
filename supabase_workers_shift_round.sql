-- عمود الوردية الافتراضية للعامل (من Excel): 1 = صباحي، 2 = مسائي، NULL = يظهر في كلا الورديتين في التحضير
-- نفّذ في Supabase SQL Editor.

ALTER TABLE public.workers
  ADD COLUMN IF NOT EXISTS shift_round smallint;

COMMENT ON COLUMN public.workers.shift_round IS '1 صباحي، 2 مسائي؛ من استيراد Excel؛ NULL = لا يُقيّد بوردية في قائمة التحضير.';

ALTER TABLE public.workers
  DROP CONSTRAINT IF EXISTS workers_shift_round_check;

ALTER TABLE public.workers
  ADD CONSTRAINT workers_shift_round_check
  CHECK (shift_round IS NULL OR shift_round IN (1, 2));

-- Upsert بالاستيراد يعتمد على تفرد رقم الهوية/الإقامة
CREATE UNIQUE INDEX IF NOT EXISTS workers_id_number_unique ON public.workers (id_number);

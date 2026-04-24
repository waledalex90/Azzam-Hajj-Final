-- Hot-path indexes for Azzam Hajj (attendance / rounds filtering)
-- Run on Supabase after review. Idempotent: IF NOT EXISTS.
-- Rationale: PostgREST filters on attendance_rounds (work_date, site_id, round_no)
-- when loading attendance_checks with nested rounds. Existing index
-- idx_att_rounds_site_date is (site_id, work_date); this adds a leading
-- work_date variant for day-scoped queries.

begin;

create index if not exists idx_att_rounds_work_date_site_round
  on public.attendance_rounds (work_date, site_id, round_no);

commit;

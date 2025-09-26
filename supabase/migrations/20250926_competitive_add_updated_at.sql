-- Ensure competitive_quizzes has columns used by triggers and app
alter table if exists public.competitive_quizzes
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists quiz_focus text;

-- If the trigger already exists, it will now work since updated_at exists.
-- No further changes needed.

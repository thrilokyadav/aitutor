-- Patch 2: add quiz_focus field and document single start time (end_at derived client-side on create)

alter table public.competitive_quizzes
  add column if not exists quiz_focus text;

-- Optional: extend open_quizzes_now to include quiz_focus (not strictly necessary for UI)
-- Drop then recreate to change OUT parameters
drop function if exists public.open_quizzes_now();
create function public.open_quizzes_now()
returns table(
  id uuid,
  title text,
  subject text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  duration_seconds int,
  published_leaderboard boolean,
  quiz_focus text
)
language sql security definer set search_path = public as $$
  select id, title, subject, description, start_at, end_at, duration_seconds, published_leaderboard, quiz_focus
  from public.competitive_quizzes
  where now() <= end_at
  order by start_at asc;
$$;

-- Add comprehensive leaderboard/results functions for admin panel
-- RPC: get all user results across all quizzes with rankings
create or replace function public.admin_get_all_user_results()
returns table(
  user_id uuid,
  user_email text,
  quiz_id uuid,
  quiz_title text,
  quiz_subject text,
  score int,
  accuracy numeric,
  time_taken_seconds int,
  submitted_at timestamptz,
  rank_in_quiz int
)
language sql security definer set search_path = public as $$
  select
    a.user_id,
    u.email as user_email,
    a.quiz_id,
    q.title as quiz_title,
    q.subject as quiz_subject,
    a.score,
    a.accuracy,
    a.time_taken_seconds,
    a.submitted_at,
    row_number() over (partition by a.quiz_id order by a.score desc nulls last, a.time_taken_seconds asc nulls last, a.submitted_at asc nulls last) as rank_in_quiz
  from public.competitive_quiz_attempts a
  join auth.users u on a.user_id = u.id
  join public.competitive_quizzes q on a.quiz_id = q.id
  where a.submitted_at is not null
    and (auth.jwt() ->> 'email') = 'info.edensnews@gmail.com'
  order by a.submitted_at desc;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.admin_get_all_user_results() to authenticated;

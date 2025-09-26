-- Public leaderboard RPC that includes user email (masked) only if leaderboard is published
create or replace function public.leaderboard_public(p_quiz_id uuid, p_limit int default 100)
returns table(
  rank int,
  user_id uuid,
  user_email text,
  state text,
  district text,
  score int,
  time_taken_seconds int,
  submitted_at timestamptz
)
language sql security definer set search_path = public as $$
  with q as (
    select id, published_leaderboard from public.competitive_quizzes where id = p_quiz_id
  ), core as (
    -- reuse existing leaderboard core if present
    select * from public.leaderboard(p_quiz_id => p_quiz_id, p_limit => p_limit)
  )
  select
    c.rank,
    c.user_id,
    case when (select published_leaderboard from q) is true then
      -- mask email like a***@domain
      (regexp_replace(u.email, '(^.).*(@.*$)', '\1***\2'))
    else null end as user_email,
    c.state,
    c.district,
    c.score,
    c.time_taken_seconds,
    c.submitted_at
  from core c
  left join auth.users u on u.id = c.user_id
  where (select published_leaderboard from q) is true
  order by c.rank
  limit coalesce(p_limit, 100);
$$;

grant execute on function public.leaderboard_public(uuid, int) to anon, authenticated;

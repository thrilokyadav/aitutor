-- Add user management functions for admin panel
-- RPC: get all users with registration info and quiz statistics
create or replace function public.admin_get_all_users()
returns table(
  id uuid,
  email text,
  created_at timestamptz,
  last_sign_in_at timestamptz,
  email_confirmed_at timestamptz,
  quiz_count int,
  total_score int,
  avg_accuracy numeric
)
language sql security definer set search_path = public as $$
  select
    u.id,
    u.email,
    u.created_at,
    u.last_sign_in_at,
    u.email_confirmed_at,
    coalesce(qc.quiz_count, 0) as quiz_count,
    coalesce(qc.total_score, 0) as total_score,
    coalesce(qc.avg_accuracy, 0) as avg_accuracy
  from auth.users u
  left join (
    select
      user_id,
      count(*) as quiz_count,
      sum(score) as total_score,
      avg(accuracy) as avg_accuracy
    from public.competitive_quiz_attempts
    where submitted_at is not null
    group by user_id
  ) qc on u.id = qc.user_id
  where (auth.jwt() ->> 'email') = 'info.edensnews@gmail.com'
  order by u.created_at desc;
$$;

-- Patch 3: Include competitive attempts in subject analytics and allow users to read attempted quizzes

-- Policy: users can select competitive_quizzes rows for quizzes they attempted (even if no longer live)
drop policy if exists cq_user_read_attempted on public.competitive_quizzes;
create policy cq_user_read_attempted on public.competitive_quizzes
  for select using (
    exists (
      select 1 from public.competitive_quiz_attempts a
      where a.quiz_id = competitive_quizzes.id
        and a.user_id = auth.uid()
    )
  );

-- Combined subject analytics: personal tests + competitive attempts
create or replace function public.subject_analytics_combined()
returns table(subject text, avg_score numeric, tests_count bigint)
language sql
security definer
set search_path = public
as $$
  with personal as (
    select t.subject, t.score::numeric as score_percent
    from public.tests t
    where t.user_id = auth.uid()
  ), comp as (
    select q.subject, coalesce(a.accuracy, 0)::numeric as score_percent
    from public.competitive_quiz_attempts a
    join public.competitive_quizzes q on q.id = a.quiz_id
    where a.user_id = auth.uid()
  ), all_rows as (
    select * from personal
    union all
    select * from comp
  )
  select subject,
         round(avg(score_percent)::numeric, 2) as avg_score,
         count(*) as tests_count
  from all_rows
  group by subject
  order by subject;
$$;

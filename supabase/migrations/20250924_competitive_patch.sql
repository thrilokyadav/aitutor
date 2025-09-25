-- Patch: allow users to fetch quiz questions for live quizzes and add quiz_payload RPC

-- Allow SELECT on questions when their quiz is live
drop policy if exists cqq_user_read_live on public.competitive_quiz_questions;
create policy cqq_user_read_live on public.competitive_quiz_questions
  for select using (
    exists (
      select 1 from public.competitive_quizzes q
      where q.id = competitive_quiz_questions.quiz_id
        and now() between q.start_at and q.end_at
    )
  );

-- RPC to fetch quiz payload (metadata + ordered questions)
create or replace function public.quiz_payload(p_quiz_id uuid)
returns table(
  id uuid,
  title text,
  subject text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  duration_seconds int,
  question_id uuid,
  question text,
  options jsonb,
  correct_index int,
  points int,
  order_index int
)
language sql security definer set search_path = public as $$
  with q as (
    select * from public.competitive_quizzes where id = p_quiz_id
  )
  select
    q.id, q.title, q.subject, q.description, q.start_at, q.end_at, q.duration_seconds,
    qq.id as question_id, qq.question, qq.options, qq.correct_index, qq.points, qq.order_index
  from q
  join public.competitive_quiz_questions qq on qq.quiz_id = q.id
  where now() <= q.end_at -- allow preview of upcoming
  order by qq.order_index asc, qq.id asc;
$$;

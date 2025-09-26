-- Add per-question explanations for competitive quizzes and expose safe user RPC
alter table if exists public.competitive_quiz_questions
  add column if not exists explanation text;

-- Admin RPC: include explanation field as well
drop function if exists public.admin_get_attempt_details(uuid);
create or replace function public.admin_get_attempt_details(p_attempt_id uuid)
returns table(
  attempt_id uuid,
  user_id uuid,
  user_email text,
  quiz_id uuid,
  quiz_title text,
  quiz_subject text,
  question_id uuid,
  question_text text,
  user_options jsonb,
  correct_index int,
  user_chosen_index int,
  is_correct boolean,
  points_earned int,
  question_order int,
  explanation text
)
language sql security definer set search_path = public as $$
  select
    a.id as attempt_id,
    a.user_id,
    u.email as user_email,
    a.quiz_id,
    q.title as quiz_title,
    q.subject as quiz_subject,
    qq.id as question_id,
    qq.question as question_text,
    qq.options as user_options,
    qq.correct_index,
    qa.chosen_index as user_chosen_index,
    qa.is_correct,
    case when qa.is_correct then qq.points else 0 end as points_earned,
    qq.order_index as question_order,
    qq.explanation as explanation
  from public.competitive_quiz_attempts a
  join auth.users u on a.user_id = u.id
  join public.competitive_quizzes q on a.quiz_id = q.id
  join public.competitive_quiz_questions qq on qq.quiz_id = a.quiz_id
  left join public.competitive_quiz_answers qa on qa.attempt_id = a.id and qa.question_id = qq.id
  where a.id = p_attempt_id
    and (auth.jwt() ->> 'email') = 'info.edensnews@gmail.com'
  order by qq.order_index;
$$;

grant execute on function public.admin_get_attempt_details(uuid) to authenticated;

-- User RPC: only allow the owner of the attempt, and only when the leaderboard is published
drop function if exists public.user_attempt_details(uuid);
create or replace function public.user_attempt_details(p_attempt_id uuid)
returns table(
  attempt_id uuid,
  quiz_id uuid,
  quiz_title text,
  quiz_subject text,
  question_id uuid,
  question_text text,
  user_options jsonb,
  correct_index int,
  user_chosen_index int,
  is_correct boolean,
  points_earned int,
  question_order int,
  explanation text
)
language sql security definer set search_path = public as $$
  with att as (
    select a.*, q.published_leaderboard, q.title, q.subject
    from public.competitive_quiz_attempts a
    join public.competitive_quizzes q on q.id = a.quiz_id
    where a.id = p_attempt_id and a.user_id = auth.uid()
  )
  select
    att.id as attempt_id,
    att.quiz_id,
    att.title as quiz_title,
    att.subject as quiz_subject,
    qq.id as question_id,
    qq.question as question_text,
    qq.options as user_options,
    qq.correct_index,
    qa.chosen_index as user_chosen_index,
    qa.is_correct,
    case when qa.is_correct then qq.points else 0 end as points_earned,
    qq.order_index as question_order,
    qq.explanation as explanation
  from att
  join public.competitive_quiz_questions qq on qq.quiz_id = att.quiz_id
  left join public.competitive_quiz_answers qa on qa.attempt_id = att.id and qa.question_id = qq.id
  where att.published_leaderboard is true
  order by qq.order_index;
$$;

grant execute on function public.user_attempt_details(uuid) to authenticated;

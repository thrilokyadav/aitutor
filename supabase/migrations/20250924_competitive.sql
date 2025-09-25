-- Competitive quiz schema and RPCs

-- Helper: admin check by email
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select coalesce((auth.jwt() ->> 'email') = 'info.edensnews@gmail.com', false);
$$;

-- Main quiz table
create table if not exists public.competitive_quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  duration_seconds int not null default 600,
  published_leaderboard boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

-- Questions
create table if not exists public.competitive_quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.competitive_quizzes(id) on delete cascade,
  question text not null,
  options jsonb not null,
  correct_index int not null,
  points int not null default 1,
  order_index int not null default 0
);

-- Attempts summary (unique per user per quiz)
create table if not exists public.competitive_quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.competitive_quizzes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz,
  score int,
  accuracy numeric,
  time_taken_seconds int,
  constraint uq_quiz_user unique (quiz_id, user_id)
);

-- Answers (per question)
create table if not exists public.competitive_quiz_answers (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.competitive_quiz_attempts(id) on delete cascade,
  question_id uuid not null references public.competitive_quiz_questions(id) on delete cascade,
  chosen_index int,
  correct_index int,
  is_correct boolean not null default false
);

-- RLS
alter table public.competitive_quizzes enable row level security;
alter table public.competitive_quiz_questions enable row level security;
alter table public.competitive_quiz_attempts enable row level security;
alter table public.competitive_quiz_answers enable row level security;

-- Quizzes: admin full access; users read active/upcoming metadata
drop policy if exists cq_admin_all on public.competitive_quizzes;
create policy cq_admin_all on public.competitive_quizzes
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists cq_user_read_active on public.competitive_quizzes;
create policy cq_user_read_active on public.competitive_quizzes
  for select using (
    now() <= end_at -- allow seeing upcoming and live; client filters
  );

-- Questions: admin only
drop policy if exists cqq_admin_all on public.competitive_quiz_questions;
create policy cqq_admin_all on public.competitive_quiz_questions
  for all using (public.is_admin()) with check (public.is_admin());

-- Attempts: users manage own attempts
drop policy if exists cqa_select_own on public.competitive_quiz_attempts;
create policy cqa_select_own on public.competitive_quiz_attempts
  for select using (auth.uid() = user_id);

drop policy if exists cqa_insert_own on public.competitive_quiz_attempts;
create policy cqa_insert_own on public.competitive_quiz_attempts
  for insert with check (auth.uid() = user_id);

drop policy if exists cqa_update_own on public.competitive_quiz_attempts;
create policy cqa_update_own on public.competitive_quiz_attempts
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Answers: users manage own via attempt relationship (enforced via function)
drop policy if exists cqan_select_via_attempt on public.competitive_quiz_answers;
create policy cqan_select_via_attempt on public.competitive_quiz_answers
  for select using (
    exists (
      select 1 from public.competitive_quiz_attempts a
      where a.id = attempt_id and a.user_id = auth.uid()
    )
  );

-- Admin can read attempts/answers for analytics
drop policy if exists cqa_admin_read on public.competitive_quiz_attempts;
create policy cqa_admin_read on public.competitive_quiz_attempts
  for select using (public.is_admin());

drop policy if exists cqan_admin_read on public.competitive_quiz_answers;
create policy cqan_admin_read on public.competitive_quiz_answers
  for select using (public.is_admin());

-- Helpful indexes
create index if not exists idx_cq_time on public.competitive_quizzes(start_at, end_at);
create index if not exists idx_cqa_user on public.competitive_quiz_attempts(user_id);

-- RPC: list quizzes available now (live) and upcoming
create or replace function public.open_quizzes_now()
returns table(
  id uuid,
  title text,
  subject text,
  description text,
  start_at timestamptz,
  end_at timestamptz,
  duration_seconds int,
  published_leaderboard boolean
)
language sql security definer set search_path = public as $$
  select id, title, subject, description, start_at, end_at, duration_seconds, published_leaderboard
  from public.competitive_quizzes
  where now() <= end_at
  order by start_at asc;
$$;

-- RPC: leaderboard (visible when published or admin)
create or replace function public.leaderboard(p_quiz_id uuid, p_limit int default 100)
returns table(rank int, user_id uuid, score int, time_taken_seconds int, submitted_at timestamptz)
language sql security definer set search_path = public as $$
  with q as (
    select * from public.competitive_quizzes where id = p_quiz_id
  ), can_view as (
    select case when public.is_admin() or exists (select 1 from q where published_leaderboard) then true else false end as ok
  )
  select row_number() over (order by a.score desc nulls last, a.time_taken_seconds asc nulls last, a.submitted_at asc nulls last) as rank,
         a.user_id,
         a.score,
         a.time_taken_seconds,
         a.submitted_at
  from public.competitive_quiz_attempts a
  where a.quiz_id = p_quiz_id and (select ok from can_view)
  order by 1
  limit greatest(1, coalesce(p_limit, 100));
$$;

-- RPC: my attempt (to block retakes)
create or replace function public.my_competitive_attempt(p_quiz_id uuid)
returns table(id uuid, submitted_at timestamptz, score int)
language sql security definer set search_path = public as $$
  select id, submitted_at, score
  from public.competitive_quiz_attempts
  where quiz_id = p_quiz_id and user_id = auth.uid();
$$;

-- RPC: submit attempt (grades on server)
create or replace function public.submit_competitive_attempt(p_quiz_id uuid, p_answers jsonb)
returns table(score int, accuracy numeric, submitted_at timestamptz)
language plpgsql security definer as $$
declare
  q record;
  already uuid;
  start_ts timestamptz;
  total_points int := 0;
  earned_points int := 0;
  ans record;
  att_id uuid;
  t_start timestamptz := now();
  dur int;
begin
  -- validate window and single attempt
  select * into q from public.competitive_quizzes where id = p_quiz_id;
  if q.id is null then
    raise exception 'Quiz not found';
  end if;
  if now() < q.start_at or now() > q.end_at then
    raise exception 'Quiz not live';
  end if;

  select id into already from public.competitive_quiz_attempts where quiz_id = p_quiz_id and user_id = auth.uid();
  if already is not null then
    raise exception 'Attempt already exists';
  end if;

  -- create attempt row (started now)
  insert into public.competitive_quiz_attempts(quiz_id, user_id, started_at)
  values (p_quiz_id, auth.uid(), now()) returning id into att_id;

  -- grade answers: p_answers is array of {question_id, chosen_index}
  for ans in
    select (elem->>'question_id')::uuid as question_id,
           (elem->>'chosen_index')::int as chosen_index
    from jsonb_array_elements(p_answers) as elem
  loop
    declare qrow record; correct int; pts int; begin
      select correct_index, points into correct, pts from public.competitive_quiz_questions where id = ans.question_id and quiz_id = p_quiz_id;
      if pts is null then pts := 1; end if;
      total_points := total_points + pts;
      if correct = ans.chosen_index then
        earned_points := earned_points + pts;
      end if;
      insert into public.competitive_quiz_answers(attempt_id, question_id, chosen_index, correct_index, is_correct)
      values (att_id, ans.question_id, ans.chosen_index, correct, (correct = ans.chosen_index));
    end;
  end loop;

  dur := extract(epoch from (now() - t_start));
  update public.competitive_quiz_attempts
  set submitted_at = now(),
      score = earned_points,
      accuracy = case when total_points > 0 then (earned_points::numeric * 100.0 / total_points) else 0 end,
      time_taken_seconds = dur
  where id = att_id;

  return query
  select earned_points as score,
         case when total_points > 0 then (earned_points::numeric * 100.0 / total_points) else 0 end as accuracy,
         now() as submitted_at;
end;$$;

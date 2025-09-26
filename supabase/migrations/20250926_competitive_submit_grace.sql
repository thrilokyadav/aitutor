-- Allow small grace window for submission to avoid client/network timing issues
create or replace function public.submit_competitive_attempt(p_quiz_id uuid, p_answers jsonb)
returns table(score int, accuracy numeric, submitted_at timestamptz)
language plpgsql security definer as $$
declare
  q record;
  already uuid;
  total_points int := 0;
  earned_points int := 0;
  ans record;
  att_id uuid;
  t_start timestamptz := now();
  dur int;
begin
  -- validate window with 10s grace after end
  select * into q from public.competitive_quizzes where id = p_quiz_id;
  if q.id is null then
    raise exception 'Quiz not found';
  end if;
  if now() < q.start_at or now() > (q.end_at + interval '10 seconds') then
    raise exception 'Quiz not live';
  end if;

  -- ensure single attempt per user
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
    declare correct int; pts int; begin
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

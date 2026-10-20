-- train: saving workouts and loading the values from last time
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Sets of the most recent finished workout of this plan day.
create function public.last_plan_day_sets(p_plan_day_id uuid)
returns setof public.workout_sets
language sql
security invoker
set search_path = ''
stable
as $$
  select s.*
  from public.workout_sets s
  where s.workout_id = (
    select w.id
    from public.workouts w
    where w.user_id = auth.uid()
      and w.plan_day_id = p_plan_day_id
      and w.finished_at is not null
    order by w.started_at desc
    limit 1
  )
  order by s.exercise_id, s.set_number;
$$;

-- Sets of one exercise from the most recent finished workout that contains it.
-- Used for swapped or added exercises.
create function public.last_exercise_sets(p_exercise_id text)
returns setof public.workout_sets
language sql
security invoker
set search_path = ''
stable
as $$
  select s.*
  from public.workout_sets s
  where s.exercise_id = p_exercise_id
    and s.workout_id = (
      select w.id
      from public.workouts w
      join public.workout_sets ws on ws.workout_id = w.id
      where w.user_id = auth.uid()
        and w.finished_at is not null
        and ws.exercise_id = p_exercise_id
      order by w.started_at desc
      limit 1
    )
  order by s.set_number;
$$;

-- Saves a finished workout with its confirmed sets in one transaction.
-- workout: { plan_day_id, started_at, finished_at,
--            sets: [{ exercise_id, set_number, weight_kg, reps, is_warmup }] }
create function public.save_workout(workout jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_workout_id uuid;
begin
  insert into public.workouts (user_id, plan_day_id, started_at, finished_at)
  values (
    auth.uid(),
    (workout ->> 'plan_day_id')::uuid,
    (workout ->> 'started_at')::timestamptz,
    (workout ->> 'finished_at')::timestamptz
  )
  returning id into new_workout_id;

  insert into public.workout_sets (workout_id, exercise_id, set_number, weight_kg, reps, is_warmup)
  select
    new_workout_id,
    s ->> 'exercise_id',
    (s ->> 'set_number')::integer,
    (s ->> 'weight_kg')::numeric,
    (s ->> 'reps')::integer,
    coalesce((s ->> 'is_warmup')::boolean, false)
  from jsonb_array_elements(workout -> 'sets') as s;

  return new_workout_id;
end;
$$;

grant execute on function public.last_plan_day_sets(uuid) to authenticated;
grant execute on function public.last_exercise_sets(text) to authenticated;
grant execute on function public.save_workout(jsonb) to authenticated;

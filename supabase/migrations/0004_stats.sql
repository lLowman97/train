-- train: statistics
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- All functions only look at the caller's finished workouts and ignore
-- warm-up sets. Estimated 1RM uses the Epley formula
-- weight * (1 + reps / 30), and the weight itself for single reps.

create function public.estimated_1rm(weight numeric, reps integer)
returns numeric
language sql
immutable
as $$
  select round(case when reps <= 1 then weight else weight * (1 + reps / 30.0) end, 1);
$$;

-- Working sets of the caller's finished workouts.
create view public.my_working_sets
with (security_invoker = true)
as
select s.*, w.started_at, w.plan_day_id
from public.workout_sets s
join public.workouts w on w.id = s.workout_id
where w.user_id = auth.uid()
  and w.finished_at is not null
  and not s.is_warmup;

-- Personal records per exercise.
create function public.exercise_records()
returns table (
  exercise_id text,
  name text,
  primary_muscle text,
  max_weight numeric,
  max_weight_reps integer,
  best_e1rm numeric,
  workouts bigint,
  last_trained timestamptz
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    e.id,
    e.name,
    e.primary_muscle,
    top.weight_kg,
    top.reps,
    max(public.estimated_1rm(s.weight_kg, s.reps)),
    count(distinct s.workout_id),
    max(s.started_at)
  from public.my_working_sets s
  join public.exercises e on e.id = s.exercise_id
  -- heaviest set, and the most reps done with that weight
  cross join lateral (
    select t.weight_kg, t.reps
    from public.my_working_sets t
    where t.exercise_id = s.exercise_id
    order by t.weight_kg desc, t.reps desc
    limit 1
  ) top
  group by e.id, e.name, e.primary_muscle, top.weight_kg, top.reps
  order by max(s.started_at) desc;
$$;

-- One row per workout for one exercise, oldest first.
create function public.exercise_history(p_exercise_id text)
returns table (
  started_at timestamptz,
  max_weight numeric,
  best_e1rm numeric,
  volume numeric,
  sets bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  select
    s.started_at,
    max(s.weight_kg),
    max(public.estimated_1rm(s.weight_kg, s.reps)),
    sum(s.weight_kg * s.reps),
    count(*)
  from public.my_working_sets s
  where s.exercise_id = p_exercise_id
  group by s.workout_id, s.started_at
  order by s.started_at;
$$;

-- Volume, sets and workouts per week (Monday start), including empty weeks.
create function public.weekly_stats(p_weeks integer, p_tz text)
returns table (
  week_start date,
  volume numeric,
  sets bigint,
  workouts bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  with weeks as (
    select generate_series(
      date_trunc('week', now() at time zone p_tz)::date - (p_weeks - 1) * 7,
      date_trunc('week', now() at time zone p_tz)::date,
      interval '7 days'
    )::date as week_start
  ),
  finished as (
    select w.id, date_trunc('week', w.started_at at time zone p_tz)::date as week_start
    from public.workouts w
    where w.user_id = auth.uid() and w.finished_at is not null
  )
  select
    weeks.week_start,
    coalesce((
      select sum(s.weight_kg * s.reps) from public.my_working_sets s
      where date_trunc('week', s.started_at at time zone p_tz)::date = weeks.week_start
    ), 0),
    (select count(*) from public.my_working_sets s
      where date_trunc('week', s.started_at at time zone p_tz)::date = weeks.week_start),
    (select count(*) from finished f where f.week_start = weeks.week_start)
  from weeks
  order by weeks.week_start;
$$;

-- Working sets per primary muscle group since a date.
create function public.muscle_sets(p_since timestamptz)
returns table (
  muscle text,
  sets bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  select coalesce(e.primary_muscle, 'other'), count(*)
  from public.my_working_sets s
  join public.exercises e on e.id = s.exercise_id
  where s.started_at >= p_since
  group by 1
  order by 2 desc;
$$;

-- Days with at least one finished workout, for the calendar heatmap.
create function public.training_days(p_days integer, p_tz text)
returns table (
  day date,
  workouts bigint
)
language sql
security invoker
set search_path = ''
stable
as $$
  select (w.started_at at time zone p_tz)::date, count(*)
  from public.workouts w
  where w.user_id = auth.uid()
    and w.finished_at is not null
    and w.started_at >= now() - make_interval(days => p_days)
  group by 1
  order by 1;
$$;

-- New records set in one workout, compared with all earlier workouts.
-- Exercises done for the first time are not reported.
create function public.workout_records(p_workout_id uuid)
returns table (
  exercise_id text,
  name text,
  kind text, -- 'weight' or 'e1rm'
  value numeric,
  previous numeric
)
language sql
security invoker
set search_path = ''
stable
as $$
  with this_workout as (
    select s.exercise_id, max(s.weight_kg) as weight, max(public.estimated_1rm(s.weight_kg, s.reps)) as e1rm,
      min(s.started_at) as started_at
    from public.my_working_sets s
    where s.workout_id = p_workout_id
    group by s.exercise_id
  ),
  before as (
    select t.exercise_id, max(s.weight_kg) as weight, max(public.estimated_1rm(s.weight_kg, s.reps)) as e1rm
    from this_workout t
    join public.my_working_sets s on s.exercise_id = t.exercise_id and s.started_at < t.started_at
    group by t.exercise_id
  )
  select t.exercise_id, e.name, r.kind, r.value, r.previous
  from this_workout t
  join before b on b.exercise_id = t.exercise_id
  join public.exercises e on e.id = t.exercise_id
  cross join lateral (
    values ('weight', t.weight, b.weight), ('e1rm', t.e1rm, b.e1rm)
  ) as r (kind, value, previous)
  where r.value > r.previous
  order by e.name, r.kind desc;
$$;

grant select on public.my_working_sets to authenticated;
grant execute on function public.estimated_1rm(numeric, integer) to authenticated;
grant execute on function public.exercise_records() to authenticated;
grant execute on function public.exercise_history(text) to authenticated;
grant execute on function public.weekly_stats(integer, text) to authenticated;
grant execute on function public.muscle_sets(timestamptz) to authenticated;
grant execute on function public.training_days(integer, text) to authenticated;
grant execute on function public.workout_records(uuid) to authenticated;

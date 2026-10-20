-- train: import plans in one transaction
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- Custom exercises created by an import may not have a muscle group yet.
alter table public.exercises alter column primary_muscle drop not null;

-- Saves a validated plan (see src/lib/plan-format.ts) with its days and
-- exercises. Runs with the caller's rights, so Row Level Security applies.
-- Exercises given by custom_name are reused if the user already has one with
-- that name, otherwise created.
create function public.import_plan(plan jsonb, source jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  new_plan_id uuid;
  new_day_id uuid;
  day jsonb;
  day_index integer := 0;
  ex jsonb;
  ex_index integer;
  ex_id text;
begin
  insert into public.plans (owner_id, name, description, source_json)
  values (auth.uid(), plan ->> 'name', plan ->> 'description', source)
  returning id into new_plan_id;

  for day in select value from jsonb_array_elements(plan -> 'days') loop
    insert into public.plan_days (plan_id, name, weekday, position)
    values (new_plan_id, day ->> 'name', (day ->> 'weekday')::smallint, day_index)
    returning id into new_day_id;

    ex_index := 0;
    for ex in select value from jsonb_array_elements(day -> 'exercises') loop
      ex_id := ex ->> 'exercise_id';

      if ex_id is null then
        select e.id into ex_id
        from public.exercises e
        where e.owner_id = auth.uid() and lower(e.name) = lower(ex ->> 'custom_name')
        limit 1;

        if ex_id is null then
          insert into public.exercises (name, primary_muscle, owner_id)
          values (ex ->> 'custom_name', ex ->> 'primary_muscle', auth.uid())
          returning id into ex_id;
        end if;
      end if;

      insert into public.plan_exercises (plan_day_id, exercise_id, sets, reps, position)
      values (new_day_id, ex_id, (ex ->> 'sets')::integer, ex ->> 'reps', ex_index);

      ex_index := ex_index + 1;
    end loop;

    day_index := day_index + 1;
  end loop;

  return new_plan_id;
end;
$$;

grant execute on function public.import_plan(jsonb, jsonb) to authenticated;

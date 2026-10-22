-- train: friends feed, friend profiles and plan sharing
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.
--
-- Friends never get direct table access to each other's data. Instead these
-- security definer functions check the friendship and the owner's privacy_*
-- settings and return only what is allowed.

alter table public.plans add column shared_by uuid references public.profiles (id) on delete set null;

-- Ids of the caller's accepted friends.
create function public.my_friend_ids()
returns setof uuid
language sql
security definer
set search_path = ''
stable
as $$
  select case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  from public.friendships f
  where f.status = 'accepted' and (f.user_id = auth.uid() or f.friend_id = auth.uid());
$$;

-- Records set in a workout compared with the owner's earlier workouts.
create function public.records_of_workout(p_workout_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', e.name,
    'weight', cur.weight, 'previous_weight', prev.weight,
    'e1rm', cur.e1rm, 'previous_e1rm', prev.e1rm
  ) order by e.name), '[]'::jsonb)
  from public.workouts w
  cross join lateral (
    select s.exercise_id, max(s.weight_kg) as weight, max(public.estimated_1rm(s.weight_kg, s.reps)) as e1rm
    from public.workout_sets s
    where s.workout_id = w.id and not s.is_warmup
    group by s.exercise_id
  ) cur
  cross join lateral (
    select max(s.weight_kg) as weight, max(public.estimated_1rm(s.weight_kg, s.reps)) as e1rm
    from public.workout_sets s
    join public.workouts w2 on w2.id = s.workout_id
    where w2.user_id = w.user_id
      and w2.finished_at is not null
      and w2.started_at < w.started_at
      and s.exercise_id = cur.exercise_id
      and not s.is_warmup
  ) prev
  join public.exercises e on e.id = cur.exercise_id
  where w.id = p_workout_id
    and prev.weight is not null
    and (cur.weight > prev.weight or cur.e1rm > prev.e1rm);
$$;

-- Latest workouts of all friends. Workout details only when the friend shares
-- workouts, records only when they share records.
create function public.friend_feed(p_limit integer default 30)
returns table (
  workout_id uuid,
  user_id uuid,
  username text,
  title text,
  started_at timestamptz,
  finished_at timestamptz,
  details jsonb,
  records jsonb
)
language sql
security definer
set search_path = ''
stable
as $$
  select * from (
    select
      w.id as workout_id,
      p.id as user_id,
      p.username,
      coalesce(d.name, 'Freies Training') as title,
      w.started_at,
      w.finished_at,
      case when p.privacy_workouts = 'friends' then (
        select jsonb_build_object(
          'sets', count(*),
          'volume', coalesce(sum(s.weight_kg * s.reps), 0),
          'exercises', (
            select coalesce(jsonb_agg(x order by x ->> 'name'), '[]'::jsonb)
            from (
              select jsonb_build_object(
                'name', e.name,
                'sets', count(*),
                'max_weight', max(s2.weight_kg)
              ) as x
              from public.workout_sets s2
              join public.exercises e on e.id = s2.exercise_id
              where s2.workout_id = w.id and not s2.is_warmup
              group by e.name
            ) per_exercise
          )
        )
        from public.workout_sets s
        where s.workout_id = w.id and not s.is_warmup
      ) end as details,
      case when p.privacy_records = 'friends' then public.records_of_workout(w.id) end as records
    from public.workouts w
    join public.profiles p on p.id = w.user_id
    left join public.plan_days d on d.id = w.plan_day_id
    where w.user_id in (select public.my_friend_ids())
      and w.finished_at is not null
      and (p.privacy_workouts = 'friends' or p.privacy_records = 'friends')
    order by w.started_at desc
    limit p_limit * 3
  ) feed
  where feed.details is not null or jsonb_array_length(coalesce(feed.records, '[]'::jsonb)) > 0
  order by feed.started_at desc
  limit p_limit;
$$;

-- What a friend shares: records, weight trend and latest measurements.
-- Returns null when the user is not a friend.
create function public.friend_profile(p_friend_id uuid)
returns jsonb
language sql
security definer
set search_path = ''
stable
as $$
  select jsonb_build_object(
    'username', p.username,
    'workouts_this_week', case when p.privacy_workouts = 'friends' then (
      select count(*) from public.workouts w
      where w.user_id = p.id and w.finished_at is not null
        and w.started_at >= date_trunc('week', now())
    ) end,
    'records', case when p.privacy_records = 'friends' then (
      select coalesce(jsonb_agg(r order by r ->> 'name'), '[]'::jsonb)
      from (
        select jsonb_build_object(
          'name', e.name,
          'max_weight', max(s.weight_kg),
          'best_e1rm', max(public.estimated_1rm(s.weight_kg, s.reps))
        ) as r
        from public.workout_sets s
        join public.workouts w on w.id = s.workout_id
        join public.exercises e on e.id = s.exercise_id
        where w.user_id = p.id and w.finished_at is not null and not s.is_warmup
        group by e.name
      ) records
    ) end,
    'weights', case when p.privacy_bodyweight = 'friends' then (
      select coalesce(jsonb_agg(jsonb_build_object('date', b.date, 'value', b.weight_kg) order by b.date), '[]'::jsonb)
      from public.body_weights b
      where b.user_id = p.id and b.date >= current_date - 180
    ) end,
    'measurements', case when p.privacy_measurements = 'friends' then (
      select coalesce(jsonb_agg(jsonb_build_object('type', m.type, 'date', m.date, 'value', m.value)), '[]'::jsonb)
      from (
        select distinct on (type) type, date, value
        from public.body_measurements
        where user_id = p.id
        order by type, date desc
      ) m
    ) end
  )
  from public.profiles p
  where p.id = p_friend_id
    and p.id in (select public.my_friend_ids());
$$;

-- Copies one of the caller's plans into a friend's account. Custom exercises
-- are reused by name in the friend's account or copied.
create function public.share_plan(p_plan_id uuid, p_friend_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  source_plan public.plans;
  new_plan_id uuid;
  new_day_id uuid;
  day public.plan_days;
  ex record;
  target_exercise_id text;
begin
  select * into source_plan from public.plans where id = p_plan_id and owner_id = auth.uid();
  if source_plan.id is null then
    raise exception 'Plan nicht gefunden.';
  end if;
  if p_friend_id not in (select public.my_friend_ids()) then
    raise exception 'Diese Person ist nicht in deiner Freundesliste.';
  end if;

  insert into public.plans (owner_id, name, description, source_json, shared_by)
  values (p_friend_id, source_plan.name, source_plan.description, source_plan.source_json, auth.uid())
  returning id into new_plan_id;

  for day in select * from public.plan_days where plan_id = p_plan_id order by position loop
    insert into public.plan_days (plan_id, name, weekday, position)
    values (new_plan_id, day.name, day.weekday, day.position)
    returning id into new_day_id;

    for ex in
      select pe.*, e.owner_id as exercise_owner, e.name as exercise_name, e.primary_muscle
      from public.plan_exercises pe
      join public.exercises e on e.id = pe.exercise_id
      where pe.plan_day_id = day.id
      order by pe.position
    loop
      target_exercise_id := ex.exercise_id;
      if ex.exercise_owner is not null then
        select e.id into target_exercise_id
        from public.exercises e
        where e.owner_id = p_friend_id and lower(e.name) = lower(ex.exercise_name)
        limit 1;
        if target_exercise_id is null then
          insert into public.exercises (name, primary_muscle, owner_id)
          values (ex.exercise_name, ex.primary_muscle, p_friend_id)
          returning id into target_exercise_id;
        end if;
      end if;

      insert into public.plan_exercises (plan_day_id, exercise_id, sets, reps, position)
      values (new_day_id, target_exercise_id, ex.sets, ex.reps, ex.position);
    end loop;
  end loop;

  return new_plan_id;
end;
$$;

-- Functions are executable by PUBLIC by default; restrict them to logged-in users.
revoke execute on function public.my_friend_ids() from public;
revoke execute on function public.records_of_workout(uuid) from public;
revoke execute on function public.friend_feed(integer) from public;
revoke execute on function public.friend_profile(uuid) from public;
revoke execute on function public.share_plan(uuid, uuid) from public;
grant execute on function public.my_friend_ids() to authenticated;
grant execute on function public.friend_feed(integer) to authenticated;
grant execute on function public.friend_profile(uuid) to authenticated;
grant execute on function public.share_plan(uuid, uuid) to authenticated;

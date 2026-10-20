-- train: initial schema
-- Run once in the Supabase dashboard: SQL Editor -> New query -> paste -> Run.

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name text,
  privacy_workouts text not null default 'friends' check (privacy_workouts in ('friends', 'private')),
  privacy_records text not null default 'friends' check (privacy_records in ('friends', 'private')),
  privacy_bodyweight text not null default 'private' check (privacy_bodyweight in ('friends', 'private')),
  privacy_measurements text not null default 'private' check (privacy_measurements in ('friends', 'private')),
  created_at timestamptz not null default now()
);

-- Creates the profile when a user signs up. The username comes from the
-- sign-up metadata (supabase.auth.signUp({ options: { data: { username } } })).
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    lower(new.raw_user_meta_data ->> 'username'),
    new.raw_user_meta_data ->> 'username'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Lets the sign-up screen check a username before creating the account.
create function public.username_available(name text)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select not exists (select 1 from public.profiles where username = lower(name));
$$;

grant execute on function public.username_available(text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Exercises (catalog rows have owner_id = null, custom ones belong to a user)
-- ---------------------------------------------------------------------------

create table public.exercises (
  id text primary key default gen_random_uuid()::text,
  name text not null,
  primary_muscle text not null check (primary_muscle in (
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
    'quads', 'hamstrings', 'glutes', 'calves', 'abs'
  )),
  secondary_muscles text[] not null default '{}',
  equipment text check (equipment in ('barbell', 'dumbbell', 'cable', 'machine', 'bodyweight')),
  owner_id uuid references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Plans (archived instead of deleted)
-- ---------------------------------------------------------------------------

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null,
  description text,
  source_json jsonb,
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now()
);

create table public.plan_days (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans (id) on delete cascade,
  name text not null,
  weekday smallint check (weekday between 1 and 7), -- 1 = Monday
  position integer not null
);

create table public.plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_day_id uuid not null references public.plan_days (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  sets integer not null check (sets > 0),
  reps text not null check (reps ~ '^[0-9]+(-[0-9]+)?$'),
  position integer not null
);

-- ---------------------------------------------------------------------------
-- Workouts (always kept, even when the plan changes)
-- ---------------------------------------------------------------------------

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  plan_day_id uuid references public.plan_days (id) on delete set null,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  note text
);

create index workouts_user_plan_day_idx on public.workouts (user_id, plan_day_id, started_at desc);

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts (id) on delete cascade,
  exercise_id text not null references public.exercises (id),
  set_number integer not null,
  weight_kg numeric(6, 2) not null check (weight_kg >= 0),
  reps integer not null check (reps >= 0),
  is_warmup boolean not null default false -- warm-up sets never count in statistics
);

create index workout_sets_workout_idx on public.workout_sets (workout_id);
create index workout_sets_exercise_idx on public.workout_sets (exercise_id);

-- ---------------------------------------------------------------------------
-- Body
-- ---------------------------------------------------------------------------

create table public.body_weights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null default current_date,
  weight_kg numeric(5, 2) not null check (weight_kg > 0),
  unique (user_id, date)
);

create table public.body_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  date date not null default current_date,
  type text not null check (type in (
    'chest', 'waist', 'hips', 'arm', 'thigh', 'calf', 'neck', 'body_fat'
  )),
  value numeric(6, 2) not null check (value > 0),
  unique (user_id, date, type)
);

create table public.goals (
  user_id uuid primary key default auth.uid() references public.profiles (id) on delete cascade,
  target_weight_kg numeric(5, 2) check (target_weight_kg > 0)
);

-- ---------------------------------------------------------------------------
-- Friends
-- ---------------------------------------------------------------------------

create table public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- For now everyone only sees their own data. Friend visibility (based on the
-- privacy_* settings) is added in phase 4.
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.plans enable row level security;
alter table public.plan_days enable row level security;
alter table public.plan_exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_sets enable row level security;
alter table public.body_weights enable row level security;
alter table public.body_measurements enable row level security;
alter table public.goals enable row level security;
alter table public.friendships enable row level security;

-- Usernames are visible to logged-in users so friends can find each other.
create policy "profiles: read" on public.profiles
  for select to authenticated using (true);
create policy "profiles: update own" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "exercises: read catalog and own" on public.exercises
  for select to authenticated using (owner_id is null or owner_id = auth.uid());
create policy "exercises: insert own" on public.exercises
  for insert to authenticated with check (owner_id = auth.uid());
create policy "exercises: update own" on public.exercises
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- No delete policies on plans and workouts: plans are archived, workouts kept.
create policy "plans: read own" on public.plans
  for select to authenticated using (owner_id = auth.uid());
create policy "plans: insert own" on public.plans
  for insert to authenticated with check (owner_id = auth.uid());
create policy "plans: update own" on public.plans
  for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "plan_days: own" on public.plan_days
  for all to authenticated
  using (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()))
  with check (exists (select 1 from public.plans p where p.id = plan_id and p.owner_id = auth.uid()));

create policy "plan_exercises: own" on public.plan_exercises
  for all to authenticated
  using (exists (
    select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.plan_days d join public.plans p on p.id = d.plan_id
    where d.id = plan_day_id and p.owner_id = auth.uid()
  ));

create policy "workouts: read own" on public.workouts
  for select to authenticated using (user_id = auth.uid());
create policy "workouts: insert own" on public.workouts
  for insert to authenticated with check (user_id = auth.uid());
create policy "workouts: update own" on public.workouts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "workout_sets: own" on public.workout_sets
  for all to authenticated
  using (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()))
  with check (exists (select 1 from public.workouts w where w.id = workout_id and w.user_id = auth.uid()));

create policy "body_weights: own" on public.body_weights
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "body_measurements: own" on public.body_measurements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "goals: own" on public.goals
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "friendships: read own" on public.friendships
  for select to authenticated using (user_id = auth.uid() or friend_id = auth.uid());
create policy "friendships: request" on public.friendships
  for insert to authenticated with check (user_id = auth.uid() and status = 'pending');
create policy "friendships: accept" on public.friendships
  for update to authenticated using (friend_id = auth.uid()) with check (friend_id = auth.uid());
create policy "friendships: remove" on public.friendships
  for delete to authenticated using (user_id = auth.uid() or friend_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Exercise catalog
-- ---------------------------------------------------------------------------

insert into public.exercises (id, name, primary_muscle, secondary_muscles, equipment) values
  -- Brust
  ('bench_press', 'Bankdrücken', 'chest', '{triceps,shoulders}', 'barbell'),
  ('incline_bench_press', 'Schrägbankdrücken (Langhantel)', 'chest', '{shoulders,triceps}', 'barbell'),
  ('dumbbell_bench_press', 'Bankdrücken (Kurzhantel)', 'chest', '{triceps,shoulders}', 'dumbbell'),
  ('incline_dumbbell_press', 'Schrägbankdrücken (Kurzhantel)', 'chest', '{shoulders,triceps}', 'dumbbell'),
  ('chest_press_machine', 'Brustpresse (Maschine)', 'chest', '{triceps,shoulders}', 'machine'),
  ('dumbbell_fly', 'Fliegende (Kurzhantel)', 'chest', '{}', 'dumbbell'),
  ('cable_fly', 'Cable Flys', 'chest', '{}', 'cable'),
  ('pec_deck', 'Butterfly (Maschine)', 'chest', '{}', 'machine'),
  ('dip', 'Dips', 'chest', '{triceps,shoulders}', 'bodyweight'),
  ('push_up', 'Liegestütze', 'chest', '{triceps,shoulders}', 'bodyweight'),
  -- Rücken
  ('deadlift', 'Kreuzheben', 'back', '{hamstrings,glutes,forearms}', 'barbell'),
  ('pull_up', 'Klimmzüge', 'back', '{biceps}', 'bodyweight'),
  ('chin_up', 'Klimmzüge (Untergriff)', 'back', '{biceps}', 'bodyweight'),
  ('lat_pulldown', 'Latziehen', 'back', '{biceps}', 'cable'),
  ('barbell_row', 'Langhantelrudern', 'back', '{biceps}', 'barbell'),
  ('dumbbell_row', 'Kurzhantelrudern (einarmig)', 'back', '{biceps}', 'dumbbell'),
  ('seated_cable_row', 'Rudern am Kabel (sitzend)', 'back', '{biceps}', 'cable'),
  ('t_bar_row', 'T-Bar-Rudern', 'back', '{biceps}', 'barbell'),
  ('machine_row', 'Rudern (Maschine)', 'back', '{biceps}', 'machine'),
  ('straight_arm_pulldown', 'Überzüge am Kabel', 'back', '{}', 'cable'),
  ('back_extension', 'Hyperextensions', 'back', '{glutes,hamstrings}', 'bodyweight'),
  ('shrug', 'Shrugs (Kurzhantel)', 'back', '{forearms}', 'dumbbell'),
  -- Schultern
  ('overhead_press', 'Schulterdrücken (Langhantel)', 'shoulders', '{triceps}', 'barbell'),
  ('dumbbell_shoulder_press', 'Schulterdrücken (Kurzhantel)', 'shoulders', '{triceps}', 'dumbbell'),
  ('shoulder_press_machine', 'Schulterpresse (Maschine)', 'shoulders', '{triceps}', 'machine'),
  ('lateral_raise', 'Seitheben (Kurzhantel)', 'shoulders', '{}', 'dumbbell'),
  ('cable_lateral_raise', 'Seitheben am Kabel', 'shoulders', '{}', 'cable'),
  ('reverse_fly', 'Reverse Flys', 'shoulders', '{back}', 'machine'),
  ('face_pull', 'Face Pulls', 'shoulders', '{back}', 'cable'),
  -- Bizeps
  ('barbell_curl', 'Langhantel-Curls', 'biceps', '{forearms}', 'barbell'),
  ('dumbbell_curl', 'Kurzhantel-Curls', 'biceps', '{forearms}', 'dumbbell'),
  ('hammer_curl', 'Hammer-Curls', 'biceps', '{forearms}', 'dumbbell'),
  ('preacher_curl', 'Scottcurls', 'biceps', '{}', 'machine'),
  ('cable_curl', 'Bizeps-Curls am Kabel', 'biceps', '{forearms}', 'cable'),
  -- Trizeps
  ('triceps_pushdown', 'Trizepsdrücken am Kabel', 'triceps', '{}', 'cable'),
  ('overhead_triceps_extension', 'Trizeps-Überkopfstrecken (Kabel)', 'triceps', '{}', 'cable'),
  ('skull_crusher', 'French Press (SZ-Stange)', 'triceps', '{}', 'barbell'),
  ('close_grip_bench_press', 'Enges Bankdrücken', 'triceps', '{chest,shoulders}', 'barbell'),
  -- Beine
  ('squat', 'Kniebeugen', 'quads', '{glutes,hamstrings}', 'barbell'),
  ('front_squat', 'Frontkniebeugen', 'quads', '{glutes}', 'barbell'),
  ('leg_press', 'Beinpresse', 'quads', '{glutes,hamstrings}', 'machine'),
  ('hack_squat', 'Hackenschmidt-Kniebeugen', 'quads', '{glutes}', 'machine'),
  ('bulgarian_split_squat', 'Bulgarische Split Squats', 'quads', '{glutes}', 'dumbbell'),
  ('lunge', 'Ausfallschritte', 'quads', '{glutes,hamstrings}', 'dumbbell'),
  ('leg_extension', 'Beinstrecker', 'quads', '{}', 'machine'),
  ('romanian_deadlift', 'Rumänisches Kreuzheben', 'hamstrings', '{glutes,back}', 'barbell'),
  ('lying_leg_curl', 'Beinbeuger (liegend)', 'hamstrings', '{}', 'machine'),
  ('seated_leg_curl', 'Beinbeuger (sitzend)', 'hamstrings', '{}', 'machine'),
  ('hip_thrust', 'Hip Thrusts', 'glutes', '{hamstrings}', 'barbell'),
  ('standing_calf_raise', 'Wadenheben (stehend)', 'calves', '{}', 'machine'),
  ('seated_calf_raise', 'Wadenheben (sitzend)', 'calves', '{}', 'machine'),
  -- Bauch
  ('crunch', 'Crunches', 'abs', '{}', 'bodyweight'),
  ('cable_crunch', 'Kabel-Crunches', 'abs', '{}', 'cable'),
  ('hanging_leg_raise', 'Hängendes Beinheben', 'abs', '{}', 'bodyweight');

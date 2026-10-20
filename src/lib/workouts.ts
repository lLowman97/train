import { supabase } from '@/lib/supabase';

export type PlanDayOption = {
  id: string;
  name: string;
  weekday: number | null;
  planName: string;
  exercises: { exerciseId: string; name: string; sets: number; reps: string }[];
};

export type PreviousSet = {
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
};

export type SavedSet = {
  exercise_id: string;
  set_number: number;
  weight_kg: number;
  reps: number;
  is_warmup: boolean;
};

const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;

/** All training days of the user's active plans. */
export async function fetchActivePlanDays(): Promise<PlanDayOption[]> {
  const { data, error } = await supabase
    .from('plan_days')
    .select(
      'id, name, weekday, position, plans!inner(name, status, created_at), plan_exercises(exercise_id, sets, reps, position, exercises(name))',
    )
    .eq('plans.status', 'active');
  if (error) throw error;

  // Many-to-one embeds come back as objects, not arrays.
  type Plan = { name: string; created_at: string };
  return data
    .map((day) => ({ day, plan: day.plans as unknown as Plan }))
    .sort((a, b) => b.plan.created_at.localeCompare(a.plan.created_at) || byPosition(a.day, b.day))
    .map(({ day, plan }) => ({
      id: day.id,
      name: day.name,
      weekday: day.weekday,
      planName: plan.name,
      exercises: [...day.plan_exercises].sort(byPosition).map((ex) => ({
        exerciseId: ex.exercise_id,
        name: (ex.exercises as unknown as { name: string } | null)?.name ?? 'Unbekannte Übung',
        sets: ex.sets,
        reps: ex.reps,
      })),
    }));
}

export async function fetchLastPlanDaySets(planDayId: string): Promise<PreviousSet[]> {
  const { data, error } = await supabase.rpc('last_plan_day_sets', { p_plan_day_id: planDayId });
  if (error) throw error;
  return data;
}

export async function fetchLastExerciseSets(exerciseId: string): Promise<PreviousSet[]> {
  const { data, error } = await supabase.rpc('last_exercise_sets', { p_exercise_id: exerciseId });
  if (error) throw error;
  return data;
}

export async function saveWorkout(workout: {
  plan_day_id: string | null;
  started_at: string;
  finished_at: string;
  sets: SavedSet[];
}): Promise<string> {
  const { data, error } = await supabase.rpc('save_workout', { workout });
  if (error) throw error;
  return data;
}

/** Number of finished workouts since Monday of the current week. */
export async function countWorkoutsThisWeek(): Promise<number> {
  const monday = new Date();
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));

  const { count, error } = await supabase
    .from('workouts')
    .select('id', { count: 'exact', head: true })
    .not('finished_at', 'is', null)
    .gte('started_at', monday.toISOString());
  if (error) throw error;
  return count ?? 0;
}

export async function createOwnExercise(name: string): Promise<{ id: string; name: string }> {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: name.trim(), owner_id: auth.user?.id })
    .select('id, name')
    .single();
  if (error) throw error;
  return data;
}

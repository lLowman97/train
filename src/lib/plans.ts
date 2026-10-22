import type { CatalogExercise, ImportPlan } from '@/lib/plan-format';
import { supabase } from '@/lib/supabase';

export type PlanStatus = 'active' | 'archived';

export type PlanSummary = {
  id: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  dayCount: number;
  sharedBy: string | null;
};

export type PlanDetail = {
  id: string;
  name: string;
  description: string | null;
  status: PlanStatus;
  days: {
    id: string;
    name: string;
    weekday: number | null;
    exercises: { id: string; name: string; sets: number; reps: string }[];
  }[];
};

/** Catalog plus the user's own exercises (RLS filters out other users'). */
export async function fetchExercises(): Promise<CatalogExercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, primary_muscle')
    .order('name');
  if (error) throw error;
  return data;
}

export async function fetchPlans(): Promise<PlanSummary[]> {
  const { data, error } = await supabase
    .from('plans')
    .select('id, name, description, status, plan_days(count), sharer:profiles!plans_shared_by_fkey(username)')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data.map((plan) => ({
    id: plan.id,
    name: plan.name,
    description: plan.description,
    status: plan.status,
    dayCount: plan.plan_days[0]?.count ?? 0,
    sharedBy: (plan.sharer as unknown as { username: string } | null)?.username ?? null,
  }));
}

export async function fetchPlan(id: string): Promise<PlanDetail> {
  const { data, error } = await supabase
    .from('plans')
    .select(
      'id, name, description, status, plan_days(id, name, weekday, position, plan_exercises(id, sets, reps, position, exercises(name)))',
    )
    .eq('id', id)
    .single();
  if (error) throw error;

  const byPosition = (a: { position: number }, b: { position: number }) => a.position - b.position;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    status: data.status,
    days: [...data.plan_days].sort(byPosition).map((day) => ({
      id: day.id,
      name: day.name,
      weekday: day.weekday,
      exercises: [...day.plan_exercises].sort(byPosition).map((ex) => ({
        id: ex.id,
        // Many-to-one embed: PostgREST returns an object, not an array.
        name: (ex.exercises as unknown as { name: string } | null)?.name ?? 'Unbekannte Übung',
        sets: ex.sets,
        reps: ex.reps,
      })),
    })),
  };
}

/** Saves the plan in one transaction and returns its id. */
export async function importPlan(plan: ImportPlan, source: unknown): Promise<string> {
  const { data, error } = await supabase.rpc('import_plan', { plan, source });
  if (error) throw error;
  return data;
}

export async function setPlanStatus(id: string, status: PlanStatus) {
  const { error } = await supabase.from('plans').update({ status }).eq('id', id);
  if (error) throw error;
}

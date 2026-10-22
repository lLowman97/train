import { supabase } from '@/lib/supabase';

// Wrappers for the statistics functions in supabase/migrations/0004_stats.sql.
// Postgres numerics arrive as strings or numbers, so everything goes through Number().

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin';

export const MUSCLE_NAMES: Record<string, string> = {
  chest: 'Brust',
  back: 'Rücken',
  shoulders: 'Schultern',
  biceps: 'Bizeps',
  triceps: 'Trizeps',
  forearms: 'Unterarme',
  quads: 'Quadrizeps',
  hamstrings: 'Beinbeuger',
  glutes: 'Gesäß',
  calves: 'Waden',
  abs: 'Bauch',
  other: 'Sonstige',
};

export type ExerciseRecord = {
  exerciseId: string;
  name: string;
  maxWeight: number;
  maxWeightReps: number;
  bestE1rm: number;
  workouts: number;
  lastTrained: string;
};

export type ExerciseHistoryEntry = {
  startedAt: string;
  maxWeight: number;
  bestE1rm: number;
  volume: number;
  sets: number;
};

export type WeekStats = { weekStart: string; volume: number; sets: number; workouts: number };
export type MuscleSets = { muscle: string; sets: number };
export type TrainingDay = { day: string; workouts: number };
export type NewRecord = { exerciseId: string; name: string; kind: 'weight' | 'e1rm'; value: number; previous: number };

export async function fetchExerciseRecords(): Promise<ExerciseRecord[]> {
  const { data, error } = await supabase.rpc('exercise_records');
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({
    exerciseId: String(r.exercise_id),
    name: String(r.name),
    maxWeight: Number(r.max_weight),
    maxWeightReps: Number(r.max_weight_reps),
    bestE1rm: Number(r.best_e1rm),
    workouts: Number(r.workouts),
    lastTrained: String(r.last_trained),
  }));
}

export async function fetchExerciseHistory(exerciseId: string): Promise<ExerciseHistoryEntry[]> {
  const { data, error } = await supabase.rpc('exercise_history', { p_exercise_id: exerciseId });
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({
    startedAt: String(r.started_at),
    maxWeight: Number(r.max_weight),
    bestE1rm: Number(r.best_e1rm),
    volume: Number(r.volume),
    sets: Number(r.sets),
  }));
}

export async function fetchWeeklyStats(weeks: number): Promise<WeekStats[]> {
  const { data, error } = await supabase.rpc('weekly_stats', { p_weeks: weeks, p_tz: TIME_ZONE });
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({
    weekStart: String(r.week_start),
    volume: Number(r.volume),
    sets: Number(r.sets),
    workouts: Number(r.workouts),
  }));
}

export async function fetchMuscleSets(since: Date): Promise<MuscleSets[]> {
  const { data, error } = await supabase.rpc('muscle_sets', { p_since: since.toISOString() });
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({ muscle: String(r.muscle), sets: Number(r.sets) }));
}

export async function fetchTrainingDays(days: number): Promise<TrainingDay[]> {
  const { data, error } = await supabase.rpc('training_days', { p_days: days, p_tz: TIME_ZONE });
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({ day: String(r.day), workouts: Number(r.workouts) }));
}

export async function fetchWorkoutRecords(workoutId: string): Promise<NewRecord[]> {
  const { data, error } = await supabase.rpc('workout_records', { p_workout_id: workoutId });
  if (error) throw error;
  return data.map((r: Record<string, unknown>) => ({
    exerciseId: String(r.exercise_id),
    name: String(r.name),
    kind: r.kind === 'weight' ? 'weight' : 'e1rm',
    value: Number(r.value),
    previous: Number(r.previous),
  }));
}

/** Consecutive weeks with at least one workout. The current week may still be empty. */
export function weekStreak(weeks: WeekStats[]): number {
  let streak = 0;
  for (let i = weeks.length - 1; i >= 0; i--) {
    if (weeks[i].workouts > 0) streak += 1;
    else if (i !== weeks.length - 1) break;
  }
  return streak;
}

export function formatKg(value: number) {
  return `${value.toLocaleString('de-DE', { maximumFractionDigits: 1 })} kg`;
}

/** "2026-10-19" or an ISO timestamp -> "19.10." */
export function formatShortDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

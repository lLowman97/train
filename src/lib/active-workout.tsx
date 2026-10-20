import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';

import {
  fetchLastExerciseSets,
  fetchLastPlanDaySets,
  saveWorkout,
  type PlanDayOption,
  type PreviousSet,
  type SavedSet,
} from '@/lib/workouts';

// The running workout lives only on the phone (AsyncStorage) until it is
// finished, so nothing gets lost without signal or when the app is closed.
// Only confirmed sets are saved; everything else is discarded.

const STORAGE_KEY = 'train.activeWorkout';

export type WorkoutSet = {
  key: string;
  weight: string; // text as typed, e.g. "82,5"
  reps: string;
  isWarmup: boolean;
  done: boolean;
};

export type WorkoutExercise = {
  key: string;
  exerciseId: string;
  name: string;
  targetSets: number | null;
  targetReps: string | null;
  sets: WorkoutSet[];
};

export type ActiveWorkout = {
  planDayId: string | null;
  title: string;
  startedAt: string;
  exercises: WorkoutExercise[];
};

export type WorkoutSummary = {
  minutes: number;
  sets: number;
  volumeKg: number;
};

type ExerciseChoice = { id: string; name: string };

type ActiveWorkoutContextValue = {
  workout: ActiveWorkout | null;
  isLoading: boolean;
  start: (day: PlanDayOption | null) => Promise<void>;
  updateSet: (exerciseKey: string, setKey: string, change: Partial<WorkoutSet>) => void;
  addSet: (exerciseKey: string) => void;
  removeSet: (exerciseKey: string, setKey: string) => void;
  addExercise: (exercise: ExerciseChoice) => Promise<void>;
  swapExercise: (exerciseKey: string, exercise: ExerciseChoice) => Promise<void>;
  removeExercise: (exerciseKey: string) => void;
  finish: () => Promise<WorkoutSummary>;
  discard: () => void;
};

const ActiveWorkoutContext = createContext<ActiveWorkoutContextValue | null>(null);

function newKey() {
  return Math.random().toString(36).slice(2, 10);
}

/** "82,5" -> 82.5; empty counts as 0 kg (e.g. pull-ups). */
export function parseWeight(text: string): number | null {
  const trimmed = text.trim().replace(',', '.');
  if (trimmed === '') return 0;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null;
}

export function parseReps(text: string): number | null {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 1 ? value : null;
}

function formatWeight(kg: number) {
  return String(Number(kg)).replace('.', ',');
}

/**
 * Prefills the sets from last time: warm-up sets first, then the working
 * sets. Without history, uses the plan's reps (lower bound) and no weight.
 */
function buildSets(previous: PreviousSet[], targetSets: number | null, targetReps: string | null) {
  const warmups = previous.filter((s) => s.is_warmup);
  const working = previous.filter((s) => !s.is_warmup);
  const count = Math.max(targetSets ?? 0, working.length, 1);
  const lastWorking = working.at(-1);
  const planReps = targetReps ? targetReps.split('-')[0] : '';

  const sets: WorkoutSet[] = warmups.map((s) => ({
    key: newKey(),
    weight: formatWeight(s.weight_kg),
    reps: String(s.reps),
    isWarmup: true,
    done: false,
  }));
  for (let i = 0; i < count; i++) {
    const prev = working[i] ?? lastWorking;
    sets.push({
      key: newKey(),
      weight: prev ? formatWeight(prev.weight_kg) : '',
      reps: prev ? String(prev.reps) : planReps,
      isWarmup: false,
      done: false,
    });
  }
  return sets;
}

export function ActiveWorkoutProvider({ children }: PropsWithChildren) {
  const [workout, setWorkout] = useState<ActiveWorkout | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((stored) => setWorkout(stored ? JSON.parse(stored) : null))
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading) return;
    if (workout) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(workout));
    else AsyncStorage.removeItem(STORAGE_KEY);
  }, [workout, isLoading]);

  const updateExercise = useCallback(
    (exerciseKey: string, update: (exercise: WorkoutExercise) => WorkoutExercise) => {
      setWorkout((current) =>
        current && {
          ...current,
          exercises: current.exercises.map((e) => (e.key === exerciseKey ? update(e) : e)),
        },
      );
    },
    [],
  );

  const start = useCallback(async (day: PlanDayOption | null) => {
    let exercises: WorkoutExercise[] = [];
    if (day) {
      const lastTime = await fetchLastPlanDaySets(day.id);
      exercises = await Promise.all(
        day.exercises.map(async (ex) => {
          let previous = lastTime.filter((s) => s.exercise_id === ex.exerciseId);
          // New plan or exercise: fall back to the last time it was trained at all.
          if (previous.length === 0) previous = await fetchLastExerciseSets(ex.exerciseId);
          return {
            key: newKey(),
            exerciseId: ex.exerciseId,
            name: ex.name,
            targetSets: ex.sets,
            targetReps: ex.reps,
            sets: buildSets(previous, ex.sets, ex.reps),
          };
        }),
      );
    }
    setWorkout({
      planDayId: day?.id ?? null,
      title: day?.name ?? 'Freies Training',
      startedAt: new Date().toISOString(),
      exercises,
    });
  }, []);

  const updateSet = useCallback(
    (exerciseKey: string, setKey: string, change: Partial<WorkoutSet>) => {
      updateExercise(exerciseKey, (e) => ({
        ...e,
        sets: e.sets.map((s) => (s.key === setKey ? { ...s, ...change } : s)),
      }));
    },
    [updateExercise],
  );

  const addSet = useCallback(
    (exerciseKey: string) => {
      updateExercise(exerciseKey, (e) => {
        const last = e.sets.at(-1);
        return {
          ...e,
          sets: [
            ...e.sets,
            { key: newKey(), weight: last?.weight ?? '', reps: last?.reps ?? '', isWarmup: false, done: false },
          ],
        };
      });
    },
    [updateExercise],
  );

  const removeSet = useCallback(
    (exerciseKey: string, setKey: string) => {
      updateExercise(exerciseKey, (e) => ({ ...e, sets: e.sets.filter((s) => s.key !== setKey) }));
    },
    [updateExercise],
  );

  const addExercise = useCallback(async (exercise: ExerciseChoice) => {
    const previous = await fetchLastExerciseSets(exercise.id);
    setWorkout(
      (current) =>
        current && {
          ...current,
          exercises: [
            ...current.exercises,
            {
              key: newKey(),
              exerciseId: exercise.id,
              name: exercise.name,
              targetSets: null,
              targetReps: null,
              sets: buildSets(previous, 3, null),
            },
          ],
        },
    );
  }, []);

  const swapExercise = useCallback(
    async (exerciseKey: string, exercise: ExerciseChoice) => {
      const previous = await fetchLastExerciseSets(exercise.id);
      updateExercise(exerciseKey, (e) => ({
        ...e,
        exerciseId: exercise.id,
        name: exercise.name,
        sets: buildSets(previous, e.targetSets ?? 3, e.targetReps),
      }));
    },
    [updateExercise],
  );

  const removeExercise = useCallback((exerciseKey: string) => {
    setWorkout(
      (current) =>
        current && { ...current, exercises: current.exercises.filter((e) => e.key !== exerciseKey) },
    );
  }, []);

  const finish = useCallback(async (): Promise<WorkoutSummary> => {
    if (!workout) throw new Error('Kein laufendes Training.');

    const sets: SavedSet[] = [];
    for (const exercise of workout.exercises) {
      let setNumber = 0;
      for (const set of exercise.sets) {
        const weight = parseWeight(set.weight);
        const reps = parseReps(set.reps);
        if (!set.done || weight === null || reps === null) continue;
        setNumber += 1;
        sets.push({
          exercise_id: exercise.exerciseId,
          set_number: setNumber,
          weight_kg: weight,
          reps,
          is_warmup: set.isWarmup,
        });
      }
    }

    const finishedAt = new Date();
    await saveWorkout({
      plan_day_id: workout.planDayId,
      started_at: workout.startedAt,
      finished_at: finishedAt.toISOString(),
      sets,
    });
    setWorkout(null);

    const working = sets.filter((s) => !s.is_warmup);
    return {
      minutes: Math.round((finishedAt.getTime() - new Date(workout.startedAt).getTime()) / 60000),
      sets: working.length,
      volumeKg: Math.round(working.reduce((sum, s) => sum + s.weight_kg * s.reps, 0)),
    };
  }, [workout]);

  const discard = useCallback(() => setWorkout(null), []);

  const value = useMemo(
    () => ({
      workout,
      isLoading,
      start,
      updateSet,
      addSet,
      removeSet,
      addExercise,
      swapExercise,
      removeExercise,
      finish,
      discard,
    }),
    [workout, isLoading, start, updateSet, addSet, removeSet, addExercise, swapExercise, removeExercise, finish, discard],
  );

  return <ActiveWorkoutContext.Provider value={value}>{children}</ActiveWorkoutContext.Provider>;
}

export function useActiveWorkout() {
  const context = useContext(ActiveWorkoutContext);
  if (!context) throw new Error('useActiveWorkout must be used inside ActiveWorkoutProvider');
  return context;
}

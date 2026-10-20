import { router, Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
} from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  parseReps,
  parseWeight,
  useActiveWorkout,
  type WorkoutExercise,
  type WorkoutSet,
} from '@/lib/active-workout';

function useElapsedMinutes(startedAt: string | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  return startedAt ? Math.max(0, Math.floor((now - new Date(startedAt).getTime()) / 60000)) : 0;
}

export default function WorkoutScreen() {
  const { workout, isLoading, finish, discard } = useActiveWorkout();
  const [saving, setSaving] = useState(false);
  const minutes = useElapsedMinutes(workout?.startedAt);

  // Finished or discarded: leave the screen.
  useEffect(() => {
    if (!isLoading && !workout && !saving) router.back();
  }, [isLoading, workout, saving]);

  if (!workout) return <ThemedView style={styles.container} />;

  const doneCount = workout.exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);

  async function save() {
    setSaving(true);
    try {
      const summary = await finish();
      Alert.alert(
        'Training gespeichert 💪',
        `${summary.minutes} min · ${summary.sets} Arbeitssätze · ${summary.volumeKg.toLocaleString('de-DE')} kg Volumen`,
      );
      router.back();
    } catch (e) {
      Alert.alert('Speichern fehlgeschlagen', e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  function confirmFinish() {
    if (doneCount === 0) {
      Alert.alert('Noch keine Sätze bestätigt', 'Bestätige Sätze mit ✓, damit sie gespeichert werden.');
      return;
    }
    const open = workout!.exercises.reduce((n, e) => n + e.sets.filter((s) => !s.done).length, 0);
    Alert.alert(
      'Training abschließen?',
      open > 0
        ? `${open} nicht bestätigte ${open === 1 ? 'Satz wird' : 'Sätze werden'} nicht gespeichert.`
        : undefined,
      [
        { text: 'Weiter trainieren', style: 'cancel' },
        { text: 'Abschließen', onPress: save },
      ],
    );
  }

  function confirmDiscard() {
    Alert.alert('Training verwerfen?', 'Alle Eingaben dieses Trainings gehen verloren.', [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Verwerfen', style: 'destructive', onPress: discard },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: workout.title }} />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            {minutes} min · {doneCount} {doneCount === 1 ? 'Satz' : 'Sätze'} bestätigt · Tippe auf die
            Satznummer für Aufwärmsatz (W)
          </ThemedText>

          {workout.exercises.map((exercise) => (
            <ExerciseCard key={exercise.key} exercise={exercise} />
          ))}

          <Button
            title="Übung hinzufügen"
            variant="secondary"
            onPress={() => router.push({ pathname: '/exercise-picker', params: { mode: 'add' } })}
          />
          <Button title="Training abschließen" busy={saving} onPress={confirmFinish} />
          <Pressable onPress={confirmDiscard} style={styles.discard}>
            <ThemedText type="small" themeColor="danger">
              Training verwerfen
            </ThemedText>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

function ExerciseCard({ exercise }: { exercise: WorkoutExercise }) {
  const { addSet, removeExercise } = useActiveWorkout();

  function showMenu() {
    Alert.alert(exercise.name, undefined, [
      {
        text: 'Übung tauschen',
        onPress: () =>
          router.push({ pathname: '/exercise-picker', params: { mode: 'swap', key: exercise.key } }),
      },
      { text: 'Übung entfernen', style: 'destructive', onPress: () => removeExercise(exercise.key) },
      { text: 'Abbrechen', style: 'cancel' },
    ]);
  }

  let workingNumber = 0;
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedView type="backgroundElement" style={styles.cardHeader}>
        <ThemedView type="backgroundElement" style={styles.cardTitle}>
          <ThemedText type="smallBold">{exercise.name}</ThemedText>
          {exercise.targetSets && exercise.targetReps && (
            <ThemedText type="small" themeColor="textSecondary">
              Ziel: {exercise.targetSets} × {exercise.targetReps}
            </ThemedText>
          )}
        </ThemedView>
        <Pressable onPress={showMenu} hitSlop={12}>
          <ThemedText themeColor="textSecondary">•••</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView type="backgroundElement" style={styles.setRow}>
        <ThemedText type="small" themeColor="textSecondary" style={styles.colNumber}>
          Satz
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.colInput}>
          kg
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.colInput}>
          Wdh.
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.colCheck} />
      </ThemedView>

      {exercise.sets.map((set) => {
        if (!set.isWarmup) workingNumber += 1;
        return (
          <SetRow
            key={set.key}
            exerciseKey={exercise.key}
            set={set}
            label={set.isWarmup ? 'W' : String(workingNumber)}
            canRemove={exercise.sets.length > 1}
          />
        );
      })}

      <Pressable onPress={() => addSet(exercise.key)} style={styles.addSet}>
        <ThemedText type="small" themeColor="accent">
          + Satz
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

function SetRow({
  exerciseKey,
  set,
  label,
  canRemove,
}: {
  exerciseKey: string;
  set: WorkoutSet;
  label: string;
  canRemove: boolean;
}) {
  const theme = useTheme();
  const { updateSet, removeSet } = useActiveWorkout();
  const weightInvalid = parseWeight(set.weight) === null;
  const repsInvalid = parseReps(set.reps) === null;

  function toggleDone() {
    if (!set.done && (weightInvalid || repsInvalid)) {
      Alert.alert('Ungültiger Satz', 'Bitte gib Gewicht (oder leer für 0 kg) und Wiederholungen ein.');
      return;
    }
    updateSet(exerciseKey, set.key, { done: !set.done });
  }

  function onLongPress() {
    if (!canRemove) return;
    Alert.alert('Satz entfernen?', undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Entfernen', style: 'destructive', onPress: () => removeSet(exerciseKey, set.key) },
    ]);
  }

  const inputStyle = [
    styles.input,
    {
      color: theme.text,
      backgroundColor: set.done ? theme.backgroundSelected : theme.background,
    },
  ];

  return (
    <ThemedView type="backgroundElement" style={styles.setRow}>
      <Pressable
        onPress={() => updateSet(exerciseKey, set.key, { isWarmup: !set.isWarmup })}
        onLongPress={onLongPress}
        style={styles.colNumber}
        hitSlop={8}>
        <ThemedText type="smallBold" themeColor={set.isWarmup ? 'accent' : 'text'}>
          {label}
        </ThemedText>
      </Pressable>
      <TextInput
        style={[inputStyle, styles.colInput, weightInvalid && { borderColor: theme.danger }]}
        value={set.weight}
        onChangeText={(weight) => updateSet(exerciseKey, set.key, { weight, done: false })}
        keyboardType="decimal-pad"
        placeholder="0"
        placeholderTextColor={theme.textSecondary}
        selectTextOnFocus
      />
      <TextInput
        style={[inputStyle, styles.colInput, repsInvalid && set.reps !== '' && { borderColor: theme.danger }]}
        value={set.reps}
        onChangeText={(reps) => updateSet(exerciseKey, set.key, { reps, done: false })}
        keyboardType="number-pad"
        placeholder="–"
        placeholderTextColor={theme.textSecondary}
        selectTextOnFocus
      />
      <Pressable
        onPress={toggleDone}
        hitSlop={8}
        style={[
          styles.colCheck,
          styles.check,
          { backgroundColor: set.done ? theme.accent : theme.background },
        ]}>
        <ThemedText type="smallBold" style={{ color: set.done ? theme.background : theme.textSecondary }}>
          ✓
        </ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  cardTitle: {
    flex: 1,
    gap: Spacing.half,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  colNumber: {
    width: 36,
    alignItems: 'center',
  },
  colInput: {
    flex: 1,
    textAlign: 'center',
  },
  colCheck: {
    width: 44,
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    paddingVertical: 10,
    borderRadius: Spacing.two,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  check: {
    height: 44,
    borderRadius: Spacing.two,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSet: {
    alignSelf: 'flex-start',
    paddingVertical: Spacing.one,
  },
  discard: {
    alignItems: 'center',
    padding: Spacing.three,
  },
});

import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveWorkout } from '@/lib/active-workout';
import type { CatalogExercise } from '@/lib/plan-format';
import { fetchExercises } from '@/lib/plans';
import { createOwnExercise } from '@/lib/workouts';

/** Picks an exercise to add to (mode=add) or swap in (mode=swap&key=...) the running workout. */
export default function ExercisePickerScreen() {
  const theme = useTheme();
  const { mode, key } = useLocalSearchParams<{ mode: 'add' | 'swap'; key?: string }>();
  const { addExercise, swapExercise } = useActiveWorkout();
  const [exercises, setExercises] = useState<CatalogExercise[] | null>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExercises()
      .then(setExercises)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (exercises ?? []).filter((e) => e.name.toLowerCase().includes(q));
  }, [exercises, query]);

  const exactMatch = exercises?.some((e) => e.name.toLowerCase() === query.trim().toLowerCase());

  async function choose(exercise: { id: string; name: string }) {
    setBusy(true);
    try {
      if (mode === 'swap' && key) await swapExercise(key, exercise);
      else await addExercise(exercise);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  async function createAndChoose() {
    setBusy(true);
    try {
      await choose(await createOwnExercise(query));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ThemedView style={styles.top}>
        <TextInput
          style={[styles.search, { color: theme.text, backgroundColor: theme.backgroundElement }]}
          placeholder="Übung suchen"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoFocus
          autoCorrect={false}
        />
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        {query.trim().length >= 3 && !exactMatch && (
          <Button
            title={`„${query.trim()}“ als eigene Übung anlegen`}
            variant="secondary"
            busy={busy}
            onPress={createAndChoose}
          />
        )}
      </ThemedView>

      {exercises === null && !error ? (
        <ActivityIndicator />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <Pressable
              disabled={busy}
              onPress={() => choose(item)}
              style={({ pressed }) => pressed && styles.pressed}>
              <ThemedView type="backgroundElement" style={styles.row}>
                <ThemedText type="small">{item.name}</ThemedText>
              </ThemedView>
            </Pressable>
          )}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  top: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  search: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: Spacing.three,
  },
  list: {
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.six,
  },
  row: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
  },
  pressed: {
    opacity: 0.7,
  },
});

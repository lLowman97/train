import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { WEEKDAY_NAMES } from '@/lib/plan-format';
import { fetchPlan, setPlanStatus, type PlanDetail } from '@/lib/plans';

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setPlan(await fetchPlan(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function toggleArchived() {
    if (!plan) return;
    setBusy(true);
    try {
      await setPlanStatus(plan.id, plan.status === 'active' ? 'archived' : 'active');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: plan?.name ?? 'Plan' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        {!plan && !error && <ActivityIndicator />}

        {plan && (
          <>
            {plan.status === 'archived' && (
              <ThemedText type="small" themeColor="textSecondary">
                Dieser Plan ist archiviert. Deine Workouts damit bleiben erhalten.
              </ThemedText>
            )}
            {plan.description && <ThemedText themeColor="textSecondary">{plan.description}</ThemedText>}

            {plan.days.map((day) => (
              <ThemedView key={day.id} type="backgroundElement" style={styles.card}>
                <ThemedView type="backgroundElement" style={styles.dayHeader}>
                  <ThemedText type="smallBold">{day.name}</ThemedText>
                  {day.weekday && (
                    <ThemedText type="small" themeColor="accent">
                      {WEEKDAY_NAMES[day.weekday - 1]}
                    </ThemedText>
                  )}
                </ThemedView>
                {day.exercises.map((ex) => (
                  <ThemedView key={ex.id} type="backgroundElement" style={styles.row}>
                    <ThemedText type="small" style={styles.exerciseName}>
                      {ex.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {ex.sets} × {ex.reps}
                    </ThemedText>
                  </ThemedView>
                ))}
              </ThemedView>
            ))}

            <Button
              title={plan.status === 'active' ? 'Plan archivieren' : 'Plan wieder aktivieren'}
              variant={plan.status === 'active' ? 'secondary' : 'primary'}
              busy={busy}
              onPress={toggleArchived}
            />
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.three,
    padding: Spacing.four,
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
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  exerciseName: {
    flex: 1,
  },
});

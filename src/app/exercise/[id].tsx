import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { fetchExerciseHistory, formatKg, formatShortDate, type ExerciseHistoryEntry } from '@/lib/stats';

type Metric = 'bestE1rm' | 'maxWeight';

const METRICS: { key: Metric; label: string }[] = [
  { key: 'bestE1rm', label: 'Geschätztes 1RM' },
  { key: 'maxWeight', label: 'Max. Gewicht' },
];

export default function ExerciseHistoryScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [history, setHistory] = useState<ExerciseHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [metric, setMetric] = useState<Metric>('bestE1rm');

  useEffect(() => {
    fetchExerciseHistory(id)
      .then(setHistory)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: name ?? 'Verlauf' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        {!history && !error && <ActivityIndicator />}

        {history && history.length > 0 && (
          <>
            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.segments}>
                {METRICS.map((m) => (
                  <Pressable key={m.key} onPress={() => setMetric(m.key)} style={styles.segmentPressable}>
                    <ThemedView
                      type={metric === m.key ? 'backgroundSelected' : 'backgroundElement'}
                      style={styles.segment}>
                      <ThemedText type="small" themeColor={metric === m.key ? 'text' : 'textSecondary'}>
                        {m.label}
                      </ThemedText>
                    </ThemedView>
                  </Pressable>
                ))}
              </View>
              <LineChart
                data={history.map((h) => ({ label: formatShortDate(h.startedAt), value: h[metric] }))}
                format={formatKg}
              />
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <View style={styles.tableRow}>
                <ThemedText type="small" themeColor="textSecondary" style={styles.colDate}>
                  Datum
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
                  Max.
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
                  1RM
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary" style={styles.col}>
                  Volumen
                </ThemedText>
              </View>
              {[...history].reverse().map((h) => (
                <View key={h.startedAt} style={styles.tableRow}>
                  <ThemedText type="small" style={styles.colDate}>
                    {formatShortDate(h.startedAt)}
                  </ThemedText>
                  <ThemedText type="small" style={styles.col}>
                    {formatKg(h.maxWeight)}
                  </ThemedText>
                  <ThemedText type="small" style={styles.col}>
                    {formatKg(h.bestE1rm)}
                  </ThemedText>
                  <ThemedText type="small" style={styles.col}>
                    {formatKg(Math.round(h.volume))}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
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
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  segments: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentPressable: {
    flex: 1,
  },
  segment: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Spacing.two,
  },
  tableRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  colDate: {
    width: 56,
  },
  col: {
    flex: 1,
    textAlign: 'right',
  },
});

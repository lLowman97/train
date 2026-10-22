import { Link, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BarChart, CalendarHeatmap, HorizontalBars } from '@/components/charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import {
  fetchExerciseRecords,
  fetchMuscleSets,
  fetchTrainingDays,
  fetchWeeklyStats,
  formatKg,
  formatShortDate,
  MUSCLE_NAMES,
  weekStreak,
  type ExerciseRecord,
  type MuscleSets,
  type WeekStats,
} from '@/lib/stats';

const CHART_WEEKS = 12;
const HEATMAP_WEEKS = 16;

type Stats = {
  weeks: WeekStats[];
  days: Map<string, number>;
  muscles: MuscleSets[];
  records: ExerciseRecord[];
};

async function loadStats(): Promise<Stats> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [weeks, days, muscles, records] = await Promise.all([
    fetchWeeklyStats(52),
    fetchTrainingDays(HEATMAP_WEEKS * 7 + 7),
    fetchMuscleSets(sevenDaysAgo),
    fetchExerciseRecords(),
  ]);
  return { weeks, days: new Map(days.map((d) => [d.day, d.workouts])), muscles, records };
}

export default function FortschrittScreen() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setStats(await loadStats());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const thisWeek = stats?.weeks.at(-1);
  const chartWeeks = stats?.weeks.slice(-CHART_WEEKS) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
            />
          }>
          <ThemedText type="subtitle">Fortschritt</ThemedText>

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          {!stats && !error && <ActivityIndicator />}

          {stats && stats.records.length === 0 && (
            <ThemedText themeColor="textSecondary">
              Noch keine Trainings gespeichert. Nach deinem ersten Training siehst du hier Rekorde,
              Verläufe und deinen Trainingskalender.
            </ThemedText>
          )}

          {stats && stats.records.length > 0 && (
            <>
              <View style={styles.tiles}>
                <StatTile label="Trainings diese Woche" value={String(thisWeek?.workouts ?? 0)} />
                <StatTile
                  label={weekStreak(stats.weeks) === 1 ? 'Woche in Folge' : 'Wochen in Folge'}
                  value={String(weekStreak(stats.weeks))}
                />
              </View>

              <Section title="Trainingskalender">
                <CalendarHeatmap days={stats.days} weeks={HEATMAP_WEEKS} />
              </Section>

              <Section title="Volumen pro Woche" hint="Gewicht × Wiederholungen aller Arbeitssätze">
                <BarChart
                  data={chartWeeks.map((w) => ({ label: `Woche ab ${formatShortDate(w.weekStart)}`, value: w.volume }))}
                  format={(v) => formatKg(Math.round(v))}
                />
              </Section>

              <Section title="Sätze pro Muskelgruppe" hint="Arbeitssätze der letzten 7 Tage">
                {stats.muscles.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    In den letzten 7 Tagen kein Training.
                  </ThemedText>
                ) : (
                  <HorizontalBars
                    data={stats.muscles.map((m) => ({ label: MUSCLE_NAMES[m.muscle] ?? m.muscle, value: m.sets }))}
                    format={(v) => `${v} ${v === 1 ? 'Satz' : 'Sätze'}`}
                  />
                )}
              </Section>

              <Section title="Rekorde" hint="Tippe auf eine Übung für den Verlauf">
                {stats.records.map((record) => (
                  <Link
                    key={record.exerciseId}
                    href={{ pathname: '/exercise/[id]', params: { id: record.exerciseId, name: record.name } }}
                    asChild>
                    <Pressable style={({ pressed }) => pressed && styles.pressed}>
                      <View style={styles.recordRow}>
                        <View style={styles.recordName}>
                          <ThemedText type="smallBold" numberOfLines={1}>
                            {record.name}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {formatKg(record.maxWeight)} × {record.maxWeightReps}
                          </ThemedText>
                        </View>
                        <View style={styles.recordValue}>
                          <ThemedText type="smallBold" themeColor="accent">
                            {formatKg(record.bestE1rm)}
                          </ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            geschätztes 1RM
                          </ThemedText>
                        </View>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </Section>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.tile}>
      <ThemedText type="subtitle">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View>
        <ThemedText type="smallBold">{title}</ThemedText>
        {hint && (
          <ThemedText type="small" themeColor="textSecondary">
            {hint}
          </ThemedText>
        )}
      </View>
      {children}
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
    paddingBottom: BottomTabInset + Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  tiles: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  tile: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  recordName: {
    flex: 1,
  },
  recordValue: {
    alignItems: 'flex-end',
  },
  pressed: {
    opacity: 0.7,
  },
});

import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useActiveWorkout } from '@/lib/active-workout';
import { WEEKDAY_NAMES } from '@/lib/plan-format';
import { useSession } from '@/lib/session';
import { countWorkoutsThisWeek, fetchActivePlanDays, type PlanDayOption } from '@/lib/workouts';

function todayWeekday() {
  return ((new Date().getDay() + 6) % 7) + 1; // 1 = Monday
}

export default function HeuteScreen() {
  const { session } = useSession();
  const { workout, start } = useActiveWorkout();
  const username = session?.user.user_metadata.username as string | undefined;

  const [days, setDays] = useState<PlanDayOption[] | null>(null);
  const [weekCount, setWeekCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      Promise.all([fetchActivePlanDays(), countWorkoutsThisWeek()])
        .then(([planDays, count]) => {
          setDays(planDays);
          setWeekCount(count);
          setError(null);
        })
        .catch((e) => setError(e instanceof Error ? e.message : String(e)));
    }, []),
  );

  async function startWorkout(day: PlanDayOption | null) {
    setStartingId(day?.id ?? 'free');
    try {
      await start(day);
      router.push('/workout');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStartingId(null);
    }
  }

  const today = todayWeekday();
  const todays = days?.filter((d) => d.weekday === today) ?? [];
  const others = days?.filter((d) => d.weekday !== today) ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedView style={styles.header}>
            <View style={styles.titleRow}>
              <ThemedText type="subtitle">Heute</ThemedText>
              <Pressable onPress={() => router.push('/profil')} hitSlop={8}>
                <ThemedText type="small" themeColor="accent">
                  Profil
                </ThemedText>
              </Pressable>
            </View>
            <ThemedText themeColor="textSecondary">
              {username ? `Hi @${username}` : 'Hi'}
              {weekCount !== null &&
                ` · ${weekCount} ${weekCount === 1 ? 'Training' : 'Trainings'} diese Woche`}
            </ThemedText>
          </ThemedView>

          {workout && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" themeColor="accent">
                TRAINING LÄUFT
              </ThemedText>
              <ThemedText type="smallBold">{workout.title}</ThemedText>
              <Button title="Training fortsetzen" onPress={() => router.push('/workout')} />
            </ThemedView>
          )}

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          {days === null && !error && <ActivityIndicator />}

          {!workout && days !== null && (
            <>
              {todays.length > 0 ? (
                todays.map((day) => (
                  <ThemedView key={day.id} type="backgroundElement" style={styles.card}>
                    <ThemedText type="smallBold" themeColor="accent">
                      HEUTE · {WEEKDAY_NAMES[today - 1].toUpperCase()}
                    </ThemedText>
                    <ThemedText type="smallBold">{day.name}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {day.planName} · {day.exercises.length} Übungen
                    </ThemedText>
                    <Button
                      title="Training starten"
                      busy={startingId === day.id}
                      disabled={startingId !== null}
                      onPress={() => startWorkout(day)}
                    />
                  </ThemedView>
                ))
              ) : (
                <ThemedText themeColor="textSecondary">
                  {days.length === 0
                    ? 'Noch kein aktiver Plan. Importiere einen Plan im Tab „Pläne“.'
                    : 'Heute ist laut Plan kein Training. Du kannst trotzdem einen Tag wählen.'}
                </ThemedText>
              )}

              {others.length > 0 && (
                <ThemedView style={styles.section}>
                  <ThemedText type="smallBold" themeColor="textSecondary">
                    {todays.length > 0 ? 'ANDERER TRAININGSTAG' : 'TRAININGSTAG WÄHLEN'}
                  </ThemedText>
                  {others.map((day) => (
                    <Pressable
                      key={day.id}
                      disabled={startingId !== null}
                      onPress={() => startWorkout(day)}
                      style={({ pressed }) => pressed && styles.pressed}>
                      <ThemedView type="backgroundElement" style={styles.row}>
                        <ThemedView type="backgroundElement" style={styles.rowText}>
                          <ThemedText type="smallBold">{day.name}</ThemedText>
                          <ThemedText type="small" themeColor="textSecondary">
                            {day.planName}
                            {day.weekday ? ` · ${WEEKDAY_NAMES[day.weekday - 1]}` : ''}
                          </ThemedText>
                        </ThemedView>
                        {startingId === day.id ? (
                          <ActivityIndicator />
                        ) : (
                          <ThemedText type="small" themeColor="accent">
                            Starten
                          </ThemedText>
                        )}
                      </ThemedView>
                    </Pressable>
                  ))}
                </ThemedView>
              )}

              <Button
                title="Freies Training ohne Plan"
                variant="secondary"
                busy={startingId === 'free'}
                disabled={startingId !== null}
                onPress={() => startWorkout(null)}
              />
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.four,
    padding: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  header: {
    gap: Spacing.one,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});

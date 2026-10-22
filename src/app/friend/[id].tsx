import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { LineChart } from '@/components/charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { formatNumber, MEASUREMENT_TYPES } from '@/lib/body';
import { fetchFriendProfile, type FriendProfile } from '@/lib/friends';
import { formatKg, formatShortDate } from '@/lib/stats';

function Private({ what }: { what: string }) {
  return (
    <ThemedText type="small" themeColor="textSecondary">
      {what} sind privat.
    </ThemedText>
  );
}

export default function FriendScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [profile, setProfile] = useState<FriendProfile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFriendProfile(id)
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, [id]);

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: name ? `@${name}` : 'Freund' }} />
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        {profile === undefined && !error && <ActivityIndicator />}
        {profile === null && (
          <ThemedText themeColor="textSecondary">Ihr seid (noch) nicht befreundet.</ThemedText>
        )}

        {profile && (
          <>
            {profile.workouts_this_week !== null && (
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="subtitle">{profile.workouts_this_week}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {profile.workouts_this_week === 1 ? 'Training' : 'Trainings'} diese Woche
                </ThemedText>
              </ThemedView>
            )}

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Rekorde</ThemedText>
              {profile.records === null ? (
                <Private what="Rekorde" />
              ) : profile.records.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Noch keine Rekorde.
                </ThemedText>
              ) : (
                profile.records.map((r) => (
                  <View key={r.name} style={styles.row}>
                    <ThemedText type="small" style={styles.flex}>
                      {r.name}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {formatKg(Number(r.max_weight))} · 1RM {formatKg(Number(r.best_e1rm))}
                    </ThemedText>
                  </View>
                ))
              )}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Körpergewicht</ThemedText>
              {profile.weights === null ? (
                <Private what="Gewichtsdaten" />
              ) : profile.weights.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Noch keine Einträge.
                </ThemedText>
              ) : (
                <LineChart
                  data={profile.weights.map((w) => ({ label: formatShortDate(w.date), value: Number(w.value) }))}
                  format={(v) => `${formatNumber(v)} kg`}
                />
              )}
            </ThemedView>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Körpermaße</ThemedText>
              {profile.measurements === null ? (
                <Private what="Körpermaße" />
              ) : profile.measurements.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary">
                  Noch keine Einträge.
                </ThemedText>
              ) : (
                MEASUREMENT_TYPES.filter((t) => profile.measurements!.some((m) => m.type === t.key)).map((t) => {
                  const m = profile.measurements!.find((x) => x.type === t.key)!;
                  return (
                    <View key={t.key} style={styles.row}>
                      <ThemedText type="small" style={styles.flex}>
                        {t.label}
                      </ThemedText>
                      <ThemedText type="small" themeColor="textSecondary">
                        {formatNumber(Number(m.value))} {t.unit} · {formatShortDate(m.date)}
                      </ThemedText>
                    </View>
                  );
                })
              )}
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
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});

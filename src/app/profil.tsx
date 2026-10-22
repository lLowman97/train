import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useActiveWorkout } from '@/lib/active-workout';
import { fetchMyProfile, updatePrivacy, type PrivacyArea, type Profile } from '@/lib/friends';
import { supabase } from '@/lib/supabase';

const AREAS: { key: PrivacyArea; label: string; hint: string }[] = [
  { key: 'privacy_workouts', label: 'Workouts', hint: 'Abgeschlossene Trainings im Feed deiner Freunde' },
  { key: 'privacy_records', label: 'Rekorde', hint: 'Neue Rekorde im Feed und deine Bestwerte' },
  { key: 'privacy_bodyweight', label: 'Körpergewicht', hint: 'Dein Gewichtsverlauf' },
  { key: 'privacy_measurements', label: 'Körpermaße', hint: 'Deine letzten Maße und Körperfett' },
];

export default function ProfilScreen() {
  const theme = useTheme();
  const { workout, discard } = useActiveWorkout();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyProfile()
      .then(setProfile)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function toggle(area: PrivacyArea, shared: boolean) {
    if (!profile) return;
    const previous = profile;
    const value = shared ? 'friends' : 'private';
    setProfile({ ...profile, [area]: value });
    try {
      await updatePrivacy(area, value);
    } catch (e) {
      setProfile(previous);
      Alert.alert('Speichern fehlgeschlagen', e instanceof Error ? e.message : String(e));
    }
  }

  function signOut() {
    Alert.alert('Abmelden?', workout ? 'Dein laufendes Training wird dabei verworfen.' : undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      {
        text: 'Abmelden',
        style: 'destructive',
        onPress: () => {
          discard();
          supabase.auth.signOut();
        },
      },
    ]);
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        {!profile && !error && <ActivityIndicator />}

        {profile && (
          <>
            <ThemedText type="subtitle">@{profile.username}</ThemedText>

            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">Was deine Freunde sehen</ThemedText>
              {AREAS.map((area) => (
                <View key={area.key} style={styles.row}>
                  <View style={styles.rowText}>
                    <ThemedText type="small">{area.label}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {area.hint}
                    </ThemedText>
                  </View>
                  <Switch
                    value={profile[area.key] === 'friends'}
                    onValueChange={(shared) => toggle(area.key, shared)}
                    trackColor={{ true: theme.accent, false: theme.backgroundSelected }}
                    thumbColor={theme.text}
                  />
                </View>
              ))}
            </ThemedView>
          </>
        )}

        <Button title="Abmelden" variant="secondary" onPress={signOut} />
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
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  rowText: {
    flex: 1,
  },
});

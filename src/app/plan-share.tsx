import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { fetchFriendLinks, sharePlan, type FriendLink } from '@/lib/friends';

/** Picks a friend to receive a copy of the plan (?id=planId&name=planName). */
export default function PlanShareScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [friends, setFriends] = useState<FriendLink[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchFriendLinks()
      .then((links) => setFriends(links.filter((l) => l.state === 'accepted')))
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  async function share(friend: FriendLink) {
    setBusyId(friend.userId);
    try {
      await sharePlan(id, friend.userId);
      Alert.alert('Plan geteilt', `@${friend.username} hat jetzt eine Kopie von „${name ?? 'deinem Plan'}“.`);
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusyId(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="small" themeColor="textSecondary">
          Dein Freund bekommt eine eigene Kopie des Plans. Änderungen daran betreffen nur seine Kopie.
        </ThemedText>
        {error && (
          <ThemedText type="small" themeColor="danger">
            {error}
          </ThemedText>
        )}
        {!friends && !error && <ActivityIndicator />}
        {friends?.length === 0 && (
          <ThemedText themeColor="textSecondary">
            Du hast noch keine Freunde. Füge sie im Tab „Freunde“ hinzu.
          </ThemedText>
        )}
        {friends?.map((friend) => (
          <Pressable
            key={friend.userId}
            disabled={busyId !== null}
            onPress={() => share(friend)}
            style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="smallBold" style={styles.flex}>
                @{friend.username}
              </ThemedText>
              {busyId === friend.userId ? (
                <ActivityIndicator />
              ) : (
                <ThemedText type="small" themeColor="accent">
                  Teilen
                </ThemedText>
              )}
            </ThemedView>
          </Pressable>
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    gap: Spacing.two,
    padding: Spacing.three,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});

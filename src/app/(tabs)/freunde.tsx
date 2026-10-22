import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  acceptFriend,
  addFriend,
  fetchFeed,
  fetchFriendLinks,
  removeFriend,
  searchUsers,
  type FeedItem,
  type FriendLink,
} from '@/lib/friends';
import { formatKg } from '@/lib/stats';

type Tab = 'feed' | 'friends';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 60) return `vor ${Math.max(1, minutes)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `vor ${hours} Std.`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'gestern' : `vor ${days} Tagen`;
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

export default function FreundeScreen() {
  const [tab, setTab] = useState<Tab>('feed');
  const [feed, setFeed] = useState<FeedItem[] | null>(null);
  const [links, setLinks] = useState<FriendLink[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [items, friendLinks] = await Promise.all([fetchFeed(), fetchFriendLinks()]);
      setFeed(items);
      setLinks(friendLinks);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const incoming = links?.filter((l) => l.state === 'incoming') ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
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
          <View style={styles.header}>
            <ThemedText type="subtitle">Freunde</ThemedText>
            <Pressable onPress={() => router.push('/profil')} hitSlop={8}>
              <ThemedText type="small" themeColor="accent">
                Privatsphäre
              </ThemedText>
            </Pressable>
          </View>

          <View style={styles.segments}>
            {(
              [
                ['feed', 'Feed'],
                ['friends', incoming.length > 0 ? `Freunde (${incoming.length} neu)` : 'Freunde'],
              ] as const
            ).map(([key, label]) => (
              <Pressable key={key} onPress={() => setTab(key)} style={styles.segmentPressable}>
                <ThemedView type={tab === key ? 'backgroundSelected' : 'backgroundElement'} style={styles.segment}>
                  <ThemedText type="small" themeColor={tab === key ? 'text' : 'textSecondary'}>
                    {label}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            ))}
          </View>

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}
          {(!feed || !links) && !error && <ActivityIndicator />}

          {tab === 'feed' && feed && links && <Feed items={feed} hasFriends={links.some((l) => l.state === 'accepted')} />}
          {tab === 'friends' && links && <FriendsList links={links} onChange={load} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Feed({ items, hasFriends }: { items: FeedItem[]; hasFriends: boolean }) {
  if (items.length === 0) {
    return (
      <ThemedText themeColor="textSecondary">
        {hasFriends
          ? 'Deine Freunde haben noch keine Trainings geteilt.'
          : 'Noch keine Freunde. Füge im Bereich „Freunde“ jemanden über den Benutzernamen hinzu.'}
      </ThemedText>
    );
  }
  return (
    <>
      {items.map((item) => (
        <ThemedView key={item.workoutId} type="backgroundElement" style={styles.card}>
          <View style={styles.feedHeader}>
            <Link href={{ pathname: '/friend/[id]', params: { id: item.userId, name: item.username } }}>
              <ThemedText type="smallBold">@{item.username}</ThemedText>
            </Link>
            <ThemedText type="small" themeColor="textSecondary">
              {timeAgo(item.finishedAt)}
            </ThemedText>
          </View>

          <ThemedText type="small" themeColor="textSecondary">
            {item.details
              ? `${item.title} · ${Math.round((new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) / 60000)} min · ${item.details.sets} Sätze · ${formatKg(Math.round(Number(item.details.volume)))}`
              : item.title}
          </ThemedText>

          {item.details?.exercises.map((ex) => (
            <View key={ex.name} style={styles.feedRow}>
              <ThemedText type="small" style={styles.flex}>
                {ex.name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {ex.sets} × bis {formatKg(Number(ex.max_weight))}
              </ThemedText>
            </View>
          ))}

          {item.records?.map((r) => {
            const weightRecord = Number(r.weight) > Number(r.previous_weight);
            return (
              <ThemedText key={r.name} type="small" themeColor="accent">
                🏆 {r.name}:{' '}
                {weightRecord
                  ? `${formatKg(Number(r.weight))} (vorher ${formatKg(Number(r.previous_weight))})`
                  : `1RM ${formatKg(Number(r.e1rm))} (vorher ${formatKg(Number(r.previous_e1rm))})`}
              </ThemedText>
            );
          })}
        </ThemedView>
      ))}
    </>
  );
}

function FriendsList({ links, onChange }: { links: FriendLink[]; onChange: () => void }) {
  const theme = useTheme();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; username: string }[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(query)
        .then(setResults)
        .catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  async function run(userId: string, action: () => Promise<void>) {
    setBusyId(userId);
    try {
      await action();
      onChange();
    } catch (e) {
      Alert.alert('Das hat nicht geklappt', errorText(e));
    } finally {
      setBusyId(null);
    }
  }

  function confirmRemove(link: FriendLink) {
    const title =
      link.state === 'accepted'
        ? `@${link.username} entfernen?`
        : link.state === 'incoming'
          ? `Anfrage von @${link.username} ablehnen?`
          : `Anfrage an @${link.username} zurückziehen?`;
    Alert.alert(title, undefined, [
      { text: 'Abbrechen', style: 'cancel' },
      { text: 'Ja', style: 'destructive', onPress: () => run(link.userId, () => removeFriend(link.userId)) },
    ]);
  }

  const known = new Map(links.map((l) => [l.userId, l]));
  const sections: [string, FriendLink[]][] = [
    ['ANFRAGEN AN DICH', links.filter((l) => l.state === 'incoming')],
    ['FREUNDE', links.filter((l) => l.state === 'accepted')],
    ['GESENDETE ANFRAGEN', links.filter((l) => l.state === 'outgoing')],
  ];

  return (
    <>
      <ThemedView type="backgroundElement" style={styles.card}>
        <ThemedText type="smallBold">Freund hinzufügen</ThemedText>
        <TextInput
          style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
          placeholder="Benutzername suchen"
          placeholderTextColor={theme.textSecondary}
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
          autoCorrect={false}
        />
        {results.map((user) => {
          const link = known.get(user.id);
          return (
            <View key={user.id} style={styles.feedRow}>
              <ThemedText type="small" style={styles.flex}>
                @{user.username}
              </ThemedText>
              {busyId === user.id ? (
                <ActivityIndicator />
              ) : link ? (
                <ThemedText type="small" themeColor="textSecondary">
                  {link.state === 'accepted' ? 'befreundet' : link.state === 'outgoing' ? 'angefragt' : 'fragt dich an'}
                </ThemedText>
              ) : (
                <Pressable onPress={() => run(user.id, () => addFriend(user.id))} hitSlop={8}>
                  <ThemedText type="small" themeColor="accent">
                    Anfragen
                  </ThemedText>
                </Pressable>
              )}
            </View>
          );
        })}
        {query.trim().length >= 2 && results.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary">
            Niemand gefunden.
          </ThemedText>
        )}
      </ThemedView>

      {sections.map(([title, items]) =>
        items.length === 0 ? null : (
          <View key={title} style={styles.section}>
            <ThemedText type="smallBold" themeColor="textSecondary">
              {title}
            </ThemedText>
            {items.map((link) => (
              <ThemedView key={link.userId} type="backgroundElement" style={styles.friendRow}>
                {link.state === 'accepted' ? (
                  <Link
                    href={{ pathname: '/friend/[id]', params: { id: link.userId, name: link.username } }}
                    style={styles.flex}>
                    <ThemedText type="smallBold">@{link.username}</ThemedText>
                  </Link>
                ) : (
                  <ThemedText type="smallBold" style={styles.flex}>
                    @{link.username}
                  </ThemedText>
                )}
                {busyId === link.userId ? (
                  <ActivityIndicator />
                ) : (
                  <>
                    {link.state === 'incoming' && (
                      <Pressable onPress={() => run(link.userId, () => acceptFriend(link.userId))} hitSlop={8}>
                        <ThemedText type="small" themeColor="accent">
                          Annehmen
                        </ThemedText>
                      </Pressable>
                    )}
                    <Pressable onPress={() => confirmRemove(link)} hitSlop={8}>
                      <ThemedText type="small" themeColor="textSecondary">
                        {link.state === 'accepted' ? 'Entfernen' : link.state === 'incoming' ? 'Ablehnen' : 'Zurückziehen'}
                      </ThemedText>
                    </Pressable>
                  </>
                )}
              </ThemedView>
            ))}
          </View>
        ),
      )}
    </>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  feedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
  input: {
    fontSize: 16,
    paddingHorizontal: Spacing.three,
    paddingVertical: 12,
    borderRadius: Spacing.three,
  },
  section: {
    gap: Spacing.two,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
});

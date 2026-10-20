import * as Clipboard from 'expo-clipboard';
import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { buildAiPrompt } from '@/lib/plan-format';
import { fetchExercises, fetchPlans, type PlanSummary } from '@/lib/plans';

export default function PlaeneScreen() {
  const [plans, setPlans] = useState<PlanSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'busy' | 'done'>('idle');

  const load = useCallback(async () => {
    try {
      setPlans(await fetchPlans());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  // Reload whenever the tab is shown, e.g. after an import.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  async function copyPrompt() {
    setCopyState('busy');
    try {
      await Clipboard.setStringAsync(buildAiPrompt(await fetchExercises()));
      setCopyState('done');
      setTimeout(() => setCopyState('idle'), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setCopyState('idle');
    }
  }

  const active = plans?.filter((p) => p.status === 'active') ?? [];
  const archived = plans?.filter((p) => p.status === 'archived') ?? [];

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
          <ThemedText type="subtitle">Pläne</ThemedText>

          <ThemedView style={styles.actions}>
            <Button title="Plan importieren" onPress={() => router.push('/plan-import')} />
            <Button
              title={copyState === 'done' ? 'Prompt kopiert ✓' : 'Prompt für KI kopieren'}
              variant="secondary"
              busy={copyState === 'busy'}
              onPress={copyPrompt}
            />
            {copyState === 'done' && (
              <ThemedText type="small" themeColor="textSecondary">
                Füge den Prompt bei ChatGPT oder Claude ein, schreib deine Wünsche dazu und
                importiere die Antwort hier.
              </ThemedText>
            )}
          </ThemedView>

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}

          {plans === null && !error && <ActivityIndicator />}

          {plans !== null && plans.length === 0 && (
            <ThemedText themeColor="textSecondary">
              Noch keine Pläne. Kopiere den Prompt, lass dir von einer KI einen Plan erstellen und
              importiere ihn.
            </ThemedText>
          )}

          {active.length > 0 && <PlanList title="Aktiv" plans={active} />}
          {archived.length > 0 && <PlanList title="Archiviert" plans={archived} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function PlanList({ title, plans }: { title: string; plans: PlanSummary[] }) {
  return (
    <ThemedView style={styles.section}>
      <ThemedText type="smallBold" themeColor="textSecondary">
        {title.toUpperCase()}
      </ThemedText>
      {plans.map((plan) => (
        <Link key={plan.id} href={{ pathname: '/plan/[id]', params: { id: plan.id } }} asChild>
          <Pressable style={({ pressed }) => pressed && styles.pressed}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{plan.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {plan.dayCount} {plan.dayCount === 1 ? 'Trainingstag' : 'Trainingstage'}
                {plan.description ? ` · ${plan.description}` : ''}
              </ThemedText>
            </ThemedView>
          </Pressable>
        </Link>
      ))}
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
  actions: {
    gap: Spacing.two,
  },
  section: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.one,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  pressed: {
    opacity: 0.7,
  },
});

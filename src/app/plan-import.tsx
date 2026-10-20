import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { parsePlan, WEEKDAY_NAMES, type CatalogExercise, type ParseResult } from '@/lib/plan-format';
import { fetchExercises, importPlan } from '@/lib/plans';

export default function PlanImportScreen() {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [exercises, setExercises] = useState<CatalogExercise[] | null>(null);
  const [result, setResult] = useState<ParseResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchExercises()
      .then(setExercises)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  function check(input: string) {
    setText(input);
    setError(null);
    setResult(exercises && input.trim() ? parsePlan(input, exercises) : null);
  }

  async function paste() {
    check(await Clipboard.getStringAsync());
  }

  async function save() {
    if (!result?.ok) return;
    setSaving(true);
    setError(null);
    try {
      const id = await importPlan(result.plan, result.source);
      router.replace({ pathname: '/plan/[id]', params: { id } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={100}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <ThemedText type="small" themeColor="textSecondary">
            Füge hier das JSON ein, das die KI für dich erstellt hat.
          </ThemedText>

          <Button title="Aus Zwischenablage einfügen" variant="secondary" onPress={paste} disabled={!exercises} />

          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.backgroundElement }]}
            placeholder={'{ "format": "train-plan", ... }'}
            placeholderTextColor={theme.textSecondary}
            value={text}
            onChangeText={check}
            multiline
            autoCapitalize="none"
            autoCorrect={false}
            editable={!!exercises && !saving}
          />

          {error && (
            <ThemedText type="small" themeColor="danger">
              {error}
            </ThemedText>
          )}

          {result && !result.ok && (
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold" themeColor="danger">
                Der Plan enthält Fehler
              </ThemedText>
              {result.errors.map((message) => (
                <ThemedText key={message} type="small">
                  • {message}
                </ThemedText>
              ))}
            </ThemedView>
          )}

          {result?.ok && (
            <>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedText type="smallBold" themeColor="accent">
                  VORSCHAU
                </ThemedText>
                <ThemedText type="smallBold">{result.plan.name}</ThemedText>
                {result.plan.description && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {result.plan.description}
                  </ThemedText>
                )}
                {result.plan.days.map((day, i) => (
                  <ThemedView key={i} type="backgroundElement" style={styles.day}>
                    <ThemedText type="small" themeColor="accent">
                      {day.name}
                      {day.weekday ? ` · ${WEEKDAY_NAMES[day.weekday - 1]}` : ''}
                    </ThemedText>
                    {day.exercises.map((ex, j) => (
                      <ThemedText key={j} type="small">
                        {ex.name} – {ex.sets} × {ex.reps}
                        {'custom_name' in ex ? ' (eigene Übung)' : ''}
                      </ThemedText>
                    ))}
                  </ThemedView>
                ))}
              </ThemedView>

              {result.warnings.map((message) => (
                <ThemedText key={message} type="small" themeColor="textSecondary">
                  ⚠︎ {message}
                </ThemedText>
              ))}

              <Button title="Plan speichern" onPress={save} busy={saving} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
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
  input: {
    minHeight: 180,
    maxHeight: 320,
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
    padding: Spacing.three,
    borderRadius: Spacing.three,
    textAlignVertical: 'top',
  },
  card: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  day: {
    gap: Spacing.half,
    marginTop: Spacing.two,
  },
});

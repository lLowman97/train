import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { LineChart } from '@/components/charts';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteBodyWeight,
  deleteMeasurement,
  fetchBodyWeights,
  fetchMeasurements,
  fetchTargetWeight,
  formatNumber,
  MEASUREMENT_TYPES,
  movingAverage,
  parsePositive,
  saveBodyWeight,
  saveMeasurement,
  saveTargetWeight,
  todayString,
  type DatedValue,
  type MeasurementType,
} from '@/lib/body';
import { formatShortDate } from '@/lib/stats';

type BodyData = {
  weights: DatedValue[];
  measurements: Record<string, DatedValue[]>;
  target: number | null;
};

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export default function KoerperScreen() {
  const [data, setData] = useState<BodyData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [weights, measurements, target] = await Promise.all([
        fetchBodyWeights(),
        fetchMeasurements(),
        fetchTargetWeight(),
      ]);
      setData({ weights, measurements, target });
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

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <KeyboardAvoidingView
          style={styles.container}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <ThemedText type="subtitle">Körper</ThemedText>
            {error && (
              <ThemedText type="small" themeColor="danger">
                {error}
              </ThemedText>
            )}
            {!data && !error && <ActivityIndicator />}
            {data && (
              <>
                <WeightCard weights={data.weights} onChange={load} />
                <GoalCard weights={data.weights} target={data.target} onChange={load} />
                <MeasurementsCard measurements={data.measurements} onChange={load} />
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

function NumberEntry({
  placeholder,
  unit,
  buttonTitle,
  onSave,
}: {
  placeholder: string;
  unit: string;
  buttonTitle: string;
  onSave: (value: number) => Promise<void>;
}) {
  const theme = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const value = parsePositive(text);
    if (value === null) {
      setError('Bitte gib eine Zahl größer als 0 ein.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(value);
      setText('');
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.entry}>
      <View style={styles.entryRow}>
        <View style={styles.entryInputWrap}>
          <TextInput
            style={[styles.input, { color: theme.text, backgroundColor: theme.background }]}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={theme.textSecondary}
            keyboardType="decimal-pad"
            onSubmitEditing={save}
          />
          <ThemedText type="small" themeColor="textSecondary" style={styles.unit}>
            {unit}
          </ThemedText>
        </View>
        <View style={styles.entryButton}>
          <Button title={buttonTitle} onPress={save} busy={busy} />
        </View>
      </View>
      {error && (
        <ThemedText type="small" themeColor="danger">
          {error}
        </ThemedText>
      )}
    </View>
  );
}

function confirmDelete(label: string, remove: () => Promise<void>, onDone: () => void) {
  Alert.alert(`${label} löschen?`, undefined, [
    { text: 'Abbrechen', style: 'cancel' },
    {
      text: 'Löschen',
      style: 'destructive',
      onPress: () =>
        remove()
          .then(onDone)
          .catch((e) => Alert.alert('Löschen fehlgeschlagen', errorText(e))),
    },
  ]);
}

function EntryList({
  entries,
  format,
  onDelete,
}: {
  entries: DatedValue[];
  format: (value: number) => string;
  onDelete: (entry: DatedValue) => void;
}) {
  return (
    <View style={styles.list}>
      {[...entries]
        .reverse()
        .slice(0, 5)
        .map((entry) => (
          <Pressable key={entry.id} onLongPress={() => onDelete(entry)} style={styles.listRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {formatShortDate(entry.date)}
            </ThemedText>
            <ThemedText type="small">{format(entry.value)}</ThemedText>
          </Pressable>
        ))}
      <ThemedText type="small" themeColor="textSecondary">
        Eintrag lange drücken zum Löschen.
      </ThemedText>
    </View>
  );
}

function WeightCard({ weights, onChange }: { weights: DatedValue[]; onChange: () => void }) {
  const theme = useTheme();
  const average = movingAverage(weights);
  const today = weights.find((w) => w.date === todayString());

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View>
        <ThemedText type="smallBold">Gewicht</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {today
            ? `Heute: ${formatNumber(today.value)} kg. Neu speichern überschreibt den Wert.`
            : 'Am besten morgens nüchtern wiegen.'}
        </ThemedText>
      </View>

      <NumberEntry
        placeholder="z. B. 82,4"
        unit="kg"
        buttonTitle="Speichern"
        onSave={async (value) => {
          await saveBodyWeight(todayString(), value);
          onChange();
        }}
      />

      {weights.length > 0 && (
        <>
          <LineChart
            data={weights.map((w, i) => ({ label: formatShortDate(w.date), value: average[i] }))}
            secondary={weights.length > 1 ? weights.map((w) => w.value) : undefined}
            detail={(i) => `gewogen ${formatNumber(weights[i].value)} kg`}
            format={(v) => `Ø ${formatNumber(v)} kg`}
          />
          {weights.length > 1 && (
            <View style={styles.legend}>
              <View style={[styles.legendLine, { backgroundColor: theme.accent }]} />
              <ThemedText type="small" themeColor="textSecondary">
                Ø 7 Tage
              </ThemedText>
              <View style={[styles.legendDot, { borderColor: theme.textSecondary }]} />
              <ThemedText type="small" themeColor="textSecondary">
                gewogen
              </ThemedText>
            </View>
          )}
          <EntryList
            entries={weights}
            format={(v) => `${formatNumber(v)} kg`}
            onDelete={(entry) =>
              confirmDelete(`Gewicht vom ${formatShortDate(entry.date)}`, () => deleteBodyWeight(entry.id), onChange)
            }
          />
        </>
      )}
    </ThemedView>
  );
}

function GoalCard({
  weights,
  target,
  onChange,
}: {
  weights: DatedValue[];
  target: number | null;
  onChange: () => void;
}) {
  const theme = useTheme();
  const [editing, setEditing] = useState(false);
  const average = movingAverage(weights);
  const start = weights[0]?.value;
  const current = average.at(-1);

  let progress: number | null = null;
  if (target !== null && start !== undefined && current !== undefined && start !== target) {
    progress = Math.max(0, Math.min(1, (start - current) / (start - target)));
  }

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="smallBold">Zielgewicht</ThemedText>
        {target !== null && !editing && (
          <Pressable onPress={() => setEditing(true)} hitSlop={8}>
            <ThemedText type="small" themeColor="accent">
              Ändern
            </ThemedText>
          </Pressable>
        )}
      </View>

      {target === null || editing ? (
        <NumberEntry
          placeholder="z. B. 78"
          unit="kg"
          buttonTitle="Ziel setzen"
          onSave={async (value) => {
            await saveTargetWeight(value);
            setEditing(false);
            onChange();
          }}
        />
      ) : (
        <>
          <View style={styles.goalRow}>
            <ThemedText type="subtitle">{formatNumber(target)} kg</ThemedText>
            {current !== undefined && (
              <ThemedText type="small" themeColor="textSecondary">
                {Math.abs(current - target) < 0.05
                  ? 'Ziel erreicht 🎉'
                  : `noch ${formatNumber(Math.abs(current - target))} kg`}
              </ThemedText>
            )}
          </View>
          {progress !== null && (
            <>
              <View style={[styles.progressTrack, { backgroundColor: theme.backgroundSelected }]}>
                <View
                  style={[styles.progressBar, { width: `${progress * 100}%`, backgroundColor: theme.accent }]}
                />
              </View>
              <ThemedText type="small" themeColor="textSecondary">
                Start {formatNumber(start!)} kg · jetzt Ø {formatNumber(current!)} kg ·{' '}
                {Math.round(progress * 100)} % geschafft
              </ThemedText>
            </>
          )}
          {weights.length === 0 && (
            <ThemedText type="small" themeColor="textSecondary">
              Trag dein Gewicht ein, um deinen Fortschritt zu sehen.
            </ThemedText>
          )}
        </>
      )}
    </ThemedView>
  );
}

function MeasurementsCard({
  measurements,
  onChange,
}: {
  measurements: Record<string, DatedValue[]>;
  onChange: () => void;
}) {
  const [selected, setSelected] = useState<MeasurementType>('waist');
  const type = MEASUREMENT_TYPES.find((t) => t.key === selected)!;
  const entries = measurements[selected] ?? [];
  const format = (v: number) => `${formatNumber(v)} ${type.unit}`;

  return (
    <ThemedView type="backgroundElement" style={styles.card}>
      <ThemedText type="smallBold">Körpermaße</ThemedText>

      <View style={styles.chips}>
        {MEASUREMENT_TYPES.map((t) => {
          const latest = measurements[t.key]?.at(-1);
          return (
            <Pressable key={t.key} onPress={() => setSelected(t.key)}>
              <ThemedView type={t.key === selected ? 'backgroundSelected' : 'background'} style={styles.chip}>
                <ThemedText type="small" themeColor={t.key === selected ? 'text' : 'textSecondary'}>
                  {t.label}
                  {latest ? ` · ${formatNumber(latest.value)}` : ''}
                </ThemedText>
              </ThemedView>
            </Pressable>
          );
        })}
      </View>

      <NumberEntry
        placeholder={type.key === 'body_fat' ? 'z. B. 18' : 'z. B. 84'}
        unit={type.unit}
        buttonTitle="Speichern"
        onSave={async (value) => {
          await saveMeasurement(todayString(), selected, value);
          onChange();
        }}
      />

      {entries.length > 0 ? (
        <>
          <LineChart
            data={entries.map((e) => ({ label: formatShortDate(e.date), value: e.value }))}
            format={format}
          />
          <EntryList
            entries={entries}
            format={format}
            onDelete={(entry) =>
              confirmDelete(`${type.label} vom ${formatShortDate(entry.date)}`, () => deleteMeasurement(entry.id), onChange)
            }
          />
        </>
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          Noch keine Werte für {type.label}.
        </ThemedText>
      )}
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
  card: {
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  entry: {
    gap: Spacing.one,
  },
  entryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  entryInputWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  input: {
    fontSize: 17,
    fontWeight: '600',
    paddingHorizontal: Spacing.three,
    paddingRight: 44,
    minHeight: 52,
    borderRadius: Spacing.three,
  },
  unit: {
    position: 'absolute',
    right: Spacing.three,
  },
  entryButton: {
    width: 130,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendLine: {
    width: 16,
    height: 2,
    borderRadius: 1,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
  },
  list: {
    gap: Spacing.one,
  },
  listRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.one,
  },
  goalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  progressTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
  },
  progressBar: {
    height: 10,
    borderRadius: 5,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
});

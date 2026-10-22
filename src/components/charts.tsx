import { useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// Small single-series charts drawn with react-native-svg. Each chart has a
// readout line above the plot: it shows the latest value and switches to the
// value under your finger when you tap a bar, point or cell (the mobile
// equivalent of a hover tooltip). Marks use the accent color, text stays in
// text colors, grid and axes are recessive.

export type ChartPoint = { label: string; value: number };

function useWidth() {
  const [width, setWidth] = useState(0);
  return { width, onLayout: (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width) };
}

function Readout({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.readout}>
      <ThemedText type="smallBold">{value}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

/** Rectangle with 4px rounded top corners, anchored to the baseline. */
function barPath(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

function niceMax(value: number) {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((s) => s * magnitude >= value) ?? 10;
  return step * magnitude;
}

export function BarChart({
  data,
  format,
  height = 140,
}: {
  data: ChartPoint[];
  format: (value: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected ?? data.length - 1;
  const max = niceMax(Math.max(...data.map((d) => d.value), 0));
  const gap = 2;
  const barWidth = data.length > 0 ? (width - gap * (data.length - 1)) / data.length : 0;

  function select(x: number) {
    if (barWidth <= 0) return;
    setSelected(Math.max(0, Math.min(data.length - 1, Math.floor(x / (barWidth + gap)))));
  }

  return (
    <View style={styles.chart}>
      {data[index] && <Readout label={data[index].label} value={format(data[index].value)} />}
      <Pressable onLayout={onLayout} onPress={(e) => select(e.nativeEvent.locationX)}>
        <Svg width={width} height={height}>
          <Line x1={0} x2={width} y1={0.5} y2={0.5} stroke={theme.backgroundSelected} strokeWidth={1} />
          <Line x1={0} x2={width} y1={height / 2} y2={height / 2} stroke={theme.backgroundSelected} strokeWidth={1} />
          {data.map((d, i) => {
            const h = d.value > 0 ? Math.max(2, (d.value / max) * (height - 1)) : 0;
            return h > 0 ? (
              <Path
                key={d.label}
                d={barPath(i * (barWidth + gap), height - h, barWidth, h)}
                fill={theme.accent}
                opacity={i === index ? 1 : 0.45}
              />
            ) : null;
          })}
          <Line x1={0} x2={width} y1={height - 0.5} y2={height - 0.5} stroke={theme.textSecondary} strokeWidth={1} />
        </Svg>
      </Pressable>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">
          {data[0]?.label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          max. {format(max)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data.at(-1)?.label}
        </ThemedText>
      </View>
    </View>
  );
}

export function LineChart({
  data,
  format,
  height = 160,
}: {
  data: ChartPoint[];
  format: (value: number) => string;
  height?: number;
}) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<number | null>(null);
  const index = selected ?? data.length - 1;

  const pad = 8; // keeps markers inside the plot
  const values = data.map((d) => d.value);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  const spread = rawMax - rawMin || Math.max(rawMax * 0.1, 1);
  const min = Math.max(0, rawMin - spread * 0.15);
  const max = rawMax + spread * 0.15;

  const x = (i: number) => (data.length === 1 ? width / 2 : pad + (i / (data.length - 1)) * (width - 2 * pad));
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (height - 2 * pad);
  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d.value)}`).join(' ');

  function select(px: number) {
    if (data.length === 0 || width === 0) return;
    let nearest = 0;
    data.forEach((_, i) => {
      if (Math.abs(x(i) - px) < Math.abs(x(nearest) - px)) nearest = i;
    });
    setSelected(nearest);
  }

  return (
    <View style={styles.chart}>
      {data[index] && <Readout label={data[index].label} value={format(data[index].value)} />}
      <Pressable onLayout={onLayout} onPress={(e) => select(e.nativeEvent.locationX)}>
        <Svg width={width} height={height}>
          {[0.25, 0.75].map((f) => (
            <Line
              key={f}
              x1={0}
              x2={width}
              y1={height * f}
              y2={height * f}
              stroke={theme.backgroundSelected}
              strokeWidth={1}
            />
          ))}
          {data[index] && (
            <Line
              x1={x(index)}
              x2={x(index)}
              y1={0}
              y2={height}
              stroke={theme.textSecondary}
              strokeWidth={1}
              strokeDasharray="3,3"
            />
          )}
          {data.length > 1 && (
            <Path d={path} stroke={theme.accent} strokeWidth={2} fill="none" strokeLinejoin="round" />
          )}
          {data.length <= 40 &&
            data.map((d, i) => (
              <Circle key={i} cx={x(i)} cy={y(d.value)} r={4} fill={theme.accent} />
            ))}
          {data[index] && (
            <Circle
              cx={x(index)}
              cy={y(data[index].value)}
              r={6}
              fill={theme.accent}
              stroke={theme.backgroundElement}
              strokeWidth={2}
            />
          )}
        </Svg>
      </Pressable>
      <View style={styles.axis}>
        <ThemedText type="small" themeColor="textSecondary">
          {data[0]?.label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {format(rawMin)} – {format(rawMax)}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {data.at(-1)?.label}
        </ThemedText>
      </View>
    </View>
  );
}

/**
 * Training calendar: one column per week (Monday on top), one cell per day.
 * `days` maps "YYYY-MM-DD" to the number of workouts.
 */
export function CalendarHeatmap({ days, weeks = 16 }: { days: Map<string, number>; weeks?: number }) {
  const theme = useTheme();
  const { width, onLayout } = useWidth();
  const [selected, setSelected] = useState<string | null>(null);

  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const start = new Date(monday);
  start.setDate(monday.getDate() - (weeks - 1) * 7);

  const gap = 3;
  const cell = width > 0 ? Math.min(18, (width - gap * (weeks - 1)) / weeks) : 0;
  const key = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const cells: { key: string; col: number; row: number; future: boolean }[] = [];
  for (let col = 0; col < weeks; col++) {
    for (let row = 0; row < 7; row++) {
      const d = new Date(start);
      d.setDate(start.getDate() + col * 7 + row);
      cells.push({ key: key(d), col, row, future: d > today });
    }
  }

  const selectedKey = selected ?? key(today);
  const selectedCount = days.get(selectedKey) ?? 0;
  const label = new Date(`${selectedKey}T12:00:00`).toLocaleDateString('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
  });

  function select(px: number, py: number) {
    if (cell <= 0) return;
    const col = Math.floor(px / (cell + gap));
    const row = Math.floor(py / (cell + gap));
    const hit = cells.find((c) => c.col === col && c.row === row && !c.future);
    if (hit) setSelected(hit.key);
  }

  return (
    <View style={styles.chart}>
      <Readout
        label={label}
        value={selectedCount === 0 ? 'Kein Training' : selectedCount === 1 ? '1 Training' : `${selectedCount} Trainings`}
      />
      <View onLayout={onLayout}>
        <Pressable onPress={(e) => select(e.nativeEvent.locationX, e.nativeEvent.locationY)}>
          <Svg width={width} height={cell * 7 + gap * 6}>
            {cells.map((c) => {
              const count = days.get(c.key) ?? 0;
              return (
                <Rect
                  key={c.key}
                  x={c.col * (cell + gap)}
                  y={c.row * (cell + gap)}
                  width={cell}
                  height={cell}
                  rx={3}
                  fill={count > 0 ? theme.accent : theme.backgroundSelected}
                  opacity={c.future ? 0.3 : 1}
                  stroke={c.key === selectedKey ? theme.text : 'none'}
                  strokeWidth={c.key === selectedKey ? 1.5 : 0}
                />
              );
            })}
          </Svg>
        </Pressable>
      </View>
      <View style={styles.legend}>
        <ThemedView type="backgroundSelected" style={styles.legendSwatch} />
        <ThemedText type="small" themeColor="textSecondary">
          kein Training
        </ThemedText>
        <View style={[styles.legendSwatch, { backgroundColor: theme.accent }]} />
        <ThemedText type="small" themeColor="textSecondary">
          trainiert
        </ThemedText>
      </View>
    </View>
  );
}

/** Horizontal bars with the label and value as text, for ranked categories. */
export function HorizontalBars({ data, format }: { data: ChartPoint[]; format: (value: number) => string }) {
  const theme = useTheme();
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <View style={styles.hbars}>
      {data.map((d) => (
        <View key={d.label} style={styles.hbarRow}>
          <ThemedText type="small" style={styles.hbarLabel} numberOfLines={1}>
            {d.label}
          </ThemedText>
          <View style={styles.hbarTrack}>
            <View
              style={[styles.hbar, { width: `${(d.value / max) * 100}%`, backgroundColor: theme.accent }]}
            />
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.hbarValue}>
            {format(d.value)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: {
    gap: Spacing.two,
  },
  readout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.two,
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  hbars: {
    gap: Spacing.two,
  },
  hbarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  hbarLabel: {
    width: 96,
  },
  hbarTrack: {
    flex: 1,
    height: 12,
  },
  hbar: {
    height: 12,
    borderRadius: 4,
    minWidth: 4,
  },
  hbarValue: {
    width: 64,
    textAlign: 'right',
  },
});

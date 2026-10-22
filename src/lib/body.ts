import { supabase } from '@/lib/supabase';

export const MEASUREMENT_TYPES = [
  { key: 'waist', label: 'Bauch', unit: 'cm' },
  { key: 'chest', label: 'Brust', unit: 'cm' },
  { key: 'arm', label: 'Arm', unit: 'cm' },
  { key: 'thigh', label: 'Oberschenkel', unit: 'cm' },
  { key: 'hips', label: 'Hüfte', unit: 'cm' },
  { key: 'calf', label: 'Wade', unit: 'cm' },
  { key: 'neck', label: 'Nacken', unit: 'cm' },
  { key: 'body_fat', label: 'Körperfett', unit: '%' },
] as const;

export type MeasurementType = (typeof MEASUREMENT_TYPES)[number]['key'];

export type DatedValue = { id: string; date: string; value: number };

/** Local date as "YYYY-MM-DD". */
export function todayString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** "82,5" -> 82.5, null if not a positive number. */
export function parsePositive(text: string): number | null {
  const value = Number(text.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;
}

export function formatNumber(value: number) {
  return value.toLocaleString('de-DE', { maximumFractionDigits: 1 });
}

async function userId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('Nicht angemeldet.');
  return data.user.id;
}

/** All weigh-ins, oldest first. */
export async function fetchBodyWeights(): Promise<DatedValue[]> {
  const { data, error } = await supabase
    .from('body_weights')
    .select('id, date, weight_kg')
    .order('date');
  if (error) throw error;
  return data.map((r) => ({ id: r.id, date: r.date, value: Number(r.weight_kg) }));
}

/** One entry per day: saving again on the same day replaces the value. */
export async function saveBodyWeight(date: string, weightKg: number) {
  const { error } = await supabase
    .from('body_weights')
    .upsert({ user_id: await userId(), date, weight_kg: weightKg }, { onConflict: 'user_id,date' });
  if (error) throw error;
}

export async function deleteBodyWeight(id: string) {
  const { error } = await supabase.from('body_weights').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchMeasurements(): Promise<Record<string, DatedValue[]>> {
  const { data, error } = await supabase
    .from('body_measurements')
    .select('id, date, type, value')
    .order('date');
  if (error) throw error;
  const byType: Record<string, DatedValue[]> = {};
  for (const r of data) {
    (byType[r.type] ??= []).push({ id: r.id, date: r.date, value: Number(r.value) });
  }
  return byType;
}

export async function saveMeasurement(date: string, type: MeasurementType, value: number) {
  const { error } = await supabase
    .from('body_measurements')
    .upsert({ user_id: await userId(), date, type, value }, { onConflict: 'user_id,date,type' });
  if (error) throw error;
}

export async function deleteMeasurement(id: string) {
  const { error } = await supabase.from('body_measurements').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTargetWeight(): Promise<number | null> {
  const { data, error } = await supabase.from('goals').select('target_weight_kg').maybeSingle();
  if (error) throw error;
  return data?.target_weight_kg == null ? null : Number(data.target_weight_kg);
}

export async function saveTargetWeight(targetKg: number | null) {
  const { error } = await supabase
    .from('goals')
    .upsert({ user_id: await userId(), target_weight_kg: targetKg }, { onConflict: 'user_id' });
  if (error) throw error;
}

/** Average of all weigh-ins in the 7 days up to and including each entry. */
export function movingAverage(entries: DatedValue[]): number[] {
  const day = (date: string) => new Date(`${date}T12:00:00`).getTime() / 86400000;
  return entries.map((entry, i) => {
    const end = day(entry.date);
    const window = entries.slice(0, i + 1).filter((e) => end - day(e.date) < 7);
    return Math.round((window.reduce((sum, e) => sum + e.value, 0) / window.length) * 10) / 10;
  });
}

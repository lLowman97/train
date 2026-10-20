import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function FortschrittScreen() {
  return (
    <ScreenPlaceholder
      title="Fortschritt"
      subtitle="Deine Entwicklung im Überblick."
      planned={[
        'Persönliche Rekorde und geschätztes 1RM',
        'Verlauf pro Übung',
        'Volumen pro Woche und Muskelgruppe',
        'Trainingsfrequenz als Kalender-Heatmap',
      ]}
    />
  );
}

import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function HeuteScreen() {
  return (
    <ScreenPlaceholder
      title="Heute"
      subtitle="Dein Training für heute."
      planned={[
        'Heutiger Trainingstag aus dem Wochenkalender',
        'Training starten mit Werten vom letzten gleichen Training',
        'Kurzstatistik der aktuellen Woche',
      ]}
    />
  );
}

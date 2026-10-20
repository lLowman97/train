import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function KoerperScreen() {
  return (
    <ScreenPlaceholder
      title="Körper"
      subtitle="Körpergewicht und Maße."
      planned={[
        'Gewicht mit 7-Tage-Durchschnitt',
        'Zielgewicht mit Fortschrittsanzeige',
        'Körpermaße und Körperfettanteil',
      ]}
    />
  );
}

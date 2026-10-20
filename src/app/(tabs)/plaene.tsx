import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function PlaeneScreen() {
  return (
    <ScreenPlaceholder
      title="Pläne"
      subtitle="Trainingspläne importieren und verwalten."
      planned={[
        'Plan als JSON einfügen und importieren',
        'Prompt für KI kopieren',
        'Trainingstage auf Wochentage legen',
        'Pläne archivieren und wieder aktivieren',
        'Pläne mit Freunden teilen',
      ]}
    />
  );
}

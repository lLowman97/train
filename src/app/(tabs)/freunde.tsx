import { ScreenPlaceholder } from '@/components/screen-placeholder';

export default function FreundeScreen() {
  return (
    <ScreenPlaceholder
      title="Freunde"
      subtitle="Sieh, was deine Trainingspartner machen."
      planned={[
        'Feed mit Workouts und Rekorden der Freunde',
        'Freunde per Benutzername oder Einladungscode hinzufügen',
        'Privatsphäre pro Bereich einstellbar',
      ]}
    />
  );
}

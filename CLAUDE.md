# train

Trainings-App für eine kleine Gruppe von Freunden (iOS + Android). Das vollständige Konzept steht in `docs/konzept.md` und ist die Grundlage für alle Funktionen. Bei Abweichungen vom Konzept erst nachfragen.

Der Entwickler hat kaum Programmiererfahrung: Änderungen in kleinen Schritten umsetzen und kurz auf Deutsch erklären, was passiert und wie man es auf dem Handy testet.

## Stack

- Expo (SDK siehe `package.json`) mit Expo Router und TypeScript, getestet über Expo Go
- Supabase für Login, Datenbank und Row Level Security. Client in `src/lib/supabase.ts`, Session über `useSession()` aus `src/lib/session.tsx`
- Datenbank-Änderungen als neue, fortlaufend nummerierte Datei in `supabase/migrations/` anlegen. Der Entwickler führt sie im Supabase SQL Editor aus, bestehende Migrationen nie nachträglich ändern
- Nur Bibliotheken verwenden, die in Expo Go laufen, solange kein Development Build eingerichtet ist

## Konventionen

- UI-Texte auf Deutsch, Code (Variablen, Funktionen, Kommentare zu Technik) gern auf Englisch
- Routen-Dateinamen ohne Umlaute (`plaene.tsx`, `koerper.tsx`)
- Farben nur aus `src/constants/theme.ts` (`accent` ist die Akzentfarbe)
- Gewichte in kg, Dezimalstellen erlaubt
- Aufwärmsätze (`is_warmup`) zählen in keiner Statistik
- Pläne werden archiviert, nie gelöscht; Workouts bleiben immer erhalten
- Freunde lesen fremde Daten nie direkt per RLS, sondern nur über die security-definer-Funktionen aus `0005_friends.sql`, die Freundschaft und `privacy_*` prüfen
- Laufendes Training liegt nur lokal (`src/lib/active-workout.tsx`) und wird erst beim Abschließen gespeichert; nur bestätigte Sätze zählen

## Befehle

```bash
npx expo start        # Dev-Server, QR-Code mit dem Handy scannen
npx expo install <p>  # Pakete installieren (statt npm install <p>)
npm run typecheck     # TypeScript prüfen
```

Expo-spezifische Regeln: @AGENTS.md

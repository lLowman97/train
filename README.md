# train

Trainings-App für mich und meine Trainingspartner: Pläne per JSON von einer KI importieren, Workouts mit Vorwerten vom letzten Training erfassen, Fortschritt und Körpergewicht auswerten und sehen, was die Freunde trainieren.

Das Konzept steht in [`docs/konzept.md`](docs/konzept.md).

## Starten (Windows)

Voraussetzungen: [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com/download/win) und die App **Expo Go** auf dem Handy.

```powershell
git clone https://github.com/lLowman97/train.git
cd train
npm ci
npx expo start
```

Zum Aktualisieren: `git pull`, dann `npm ci` und `npx expo start`. `npm ci` statt `npm install` verwenden, damit `package-lock.json` unverändert bleibt.

QR-Code scannen: unter iOS mit der Kamera-App, unter Android in Expo Go. PC und Handy müssen im selben WLAN sein, sonst `npx expo start --tunnel` verwenden.

## Datenbank einrichten

Die Dateien in `supabase/migrations/` der Reihe nach im Supabase-Dashboard ausführen: **SQL Editor → New query →** Inhalt einfügen **→ Run**.

## Stand

- [x] Phase 0: Projekt-Setup mit fünf Tabs (Heute, Pläne, Fortschritt, Körper, Freunde)
- [x] Phase 1: Login, Übungskatalog, JSON-Import, Training erfassen
  - [x] Datenbank, Übungskatalog, Registrierung und Login
  - [x] JSON-Import mit Vorschau, Prompt für KI und Archivieren
  - [x] Training erfassen mit Vorwerten, Aufwärmsätzen und Übungstausch
- [x] Phase 2: Statistiken (Rekorde, Verlauf pro Übung, Volumen, Muskelgruppen, Trainingskalender)
- [x] Phase 3: Körpergewicht mit Ø 7 Tage, Zielgewicht, Körpermaße und KFA
- [x] Phase 4: Freunde (Anfragen, Feed, Freundesprofile, Pläne teilen, Privatsphäre)

## Für Freunde veröffentlichen (EAS Update)

Einmalig: Konto auf [expo.dev](https://expo.dev) anlegen, dann

```powershell
npx eas-cli@latest login
npx eas-cli@latest init
npx eas-cli@latest update:configure
```

Neue Version veröffentlichen:

```powershell
npx eas-cli@latest update --branch main --message "Kurze Beschreibung"
```

Den Link bzw. QR-Code zur Version gibt es auf expo.dev unter dem Projekt → Updates. Freunde öffnen ihn in Expo Go.

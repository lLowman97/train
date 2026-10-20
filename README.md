# train

Trainings-App für mich und meine Trainingspartner: Pläne per JSON von einer KI importieren, Workouts mit Vorwerten vom letzten Training erfassen, Fortschritt und Körpergewicht auswerten und sehen, was die Freunde trainieren.

Das Konzept steht in [`docs/konzept.md`](docs/konzept.md).

## Starten (Windows)

Voraussetzungen: [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com/download/win) und die App **Expo Go** auf dem Handy.

```powershell
git clone https://github.com/lLowman97/train.git
cd train
npm install
npx expo start
```

QR-Code scannen: unter iOS mit der Kamera-App, unter Android in Expo Go. PC und Handy müssen im selben WLAN sein, sonst `npx expo start --tunnel` verwenden.

## Datenbank einrichten

Die Dateien in `supabase/migrations/` der Reihe nach im Supabase-Dashboard ausführen: **SQL Editor → New query →** Inhalt einfügen **→ Run**.

## Stand

- [x] Phase 0: Projekt-Setup mit fünf Tabs (Heute, Pläne, Fortschritt, Körper, Freunde)
- [ ] Phase 1: Login, Übungskatalog, JSON-Import, Training erfassen
  - [x] Datenbank, Übungskatalog, Registrierung und Login
  - [ ] JSON-Import
  - [ ] Training erfassen
- [ ] Phase 2: Statistiken
- [ ] Phase 3: Körpergewicht und Maße
- [ ] Phase 4: Freunde

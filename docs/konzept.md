# train: Konzept

Stand: 20.10.2026

## 1. Vision

**train** ist eine moderne Trainings-App für mich und meine Trainingspartner. Trainingspläne lässt man sich von einer KI im JSON-Format erstellen und importiert sie in die App. Im Gym sind die Werte vom letzten gleichen Training schon eingetragen, man bestätigt oder passt sie nur an. Fortschritt, Rekorde und Körpergewicht werden übersichtlich ausgewertet, und man sieht, was die Freunde trainieren.

## 2. Rahmenbedingungen

| Thema | Entscheidung |
|---|---|
| Zielgruppe | Ich + Freunde/Trainingspartner (kleine, geschlossene Gruppe) |
| Plattform | iOS + Android |
| Umsetzung | Mit KI-Hilfe programmieren (Einstieg ohne Vorkenntnisse) |
| Tech-Stack | **React Native mit Expo** (App) + **Supabase** (Datenbank, Login, API) |
| Verteilung | Expo Go / Testlink, kein App Store nötig |
| Design | Modern & schick |
| Kosten | 0 € (Supabase- und Expo-Gratisstufen reichen für eine kleine Gruppe) |

**Warum Expo + Supabase?** Eine Codebasis für iOS und Android, JavaScript/TypeScript (das am besten von KI unterstützt wird), Testen auf dem eigenen Handy per QR-Code und ein fertiges Backend mit Login und Berechtigungen. Einen eigenen Server muss man nicht betreiben.

## 3. Funktionen

### 3.1 Trainingspläne (Import per JSON)
- Pläne werden **nicht** in der App zusammengeklickt, sondern von einer KI (ChatGPT/Claude) im festgelegten JSON-Format erzeugt.
- Import: JSON-Text in ein Eingabefeld einfügen → App prüft das Format → Vorschau → Speichern.
- Klare Fehlermeldungen bei ungültigem JSON (z. B. „Übung 'Bankdrücken Schräg' unbekannt, als eigene Übung anlegen?“).
- Inhalt eines Plans: Trainingstage mit Übungen, Satzanzahl und Wiederholungen (auch Bereiche wie 8–10).
- **Wochenkalender**: Trainingstage werden Wochentagen zugeordnet, die App zeigt „Heute: Push-Tag“.
- Pläne an Freunde teilen (die App erstellt eine Kopie im Konto des Freundes).
- Pläne werden **nie gelöscht, sondern archiviert**. Ein archivierter Plan kann jederzeit wieder aktiviert werden. Die Vorwerte kommen dann wieder vom letzten Training dieses Plans, auch wenn es Monate her ist.
- Workouts bleiben immer erhalten, unabhängig davon, was mit dem Plan passiert.

### 3.2 Workout-Tracking im Gym
- Training starten: aus dem Kalender („Heute“) oder durch Auswahl eines Trainingstags.
- Pro Satz werden **Gewicht und Wiederholungen** erfasst. Das Gewicht wird frei eingetippt (Zahlentastatur, Dezimalstellen wie 22,5 kg erlaubt).
- Sätze können als **Aufwärmsatz** markiert werden (Tipp auf die Satznummer → „W“). Man kann jederzeit zusätzliche Aufwärmsätze vor den Arbeitssätzen einfügen.
- **Vorausgefüllt mit den Werten vom letzten gleichen Training**. Ein Tipp bestätigt, oder man ändert den Wert.
- Beim ersten Mal (ohne Vorwerte) werden die Wiederholungen aus dem Plan übernommen und das Gewicht ist leer.
- **Übungen spontan tauschen oder hinzufügen** (z. B. wenn ein Gerät belegt ist), die Auswahl kommt aus dem Katalog.
- Training abschließen → Zusammenfassung (Dauer, Volumen, neue Rekorde).
- Kein Pausen-Timer.
- Es zählt nur, was eingetragen und bestätigt ist. Nicht bestätigte Sätze werden beim Abschließen verworfen, ein „nicht geschafft“-Status existiert nicht.
- Laufendes Training wird lokal zwischengespeichert, damit bei Funkloch oder App-Absturz nichts verloren geht.

### 3.3 Übungskatalog
- Vorinstallierter Katalog mit **ca. 50 gängigen Übungen** (Langhantel, Kurzhantel, Kabelzug, Maschinen, Körpergewicht) mit eindeutigen IDs (z. B. `bench_press`), Name und Muskelgruppen (primär/sekundär).
- Man kann **eigene Übungen** ergänzen.
- Feste IDs halten die Statistiken sauber („Bankdrücken“ ist immer dieselbe Übung).

### 3.4 Fortschritt & Statistiken
- **Aufwärmsätze zählen nirgends mit**: nicht bei Rekorden, nicht im Verlauf, nicht im Volumen und nicht bei den Sätzen pro Muskelgruppe.
- **Persönliche Rekorde**: schwerstes Gewicht, bestes geschätztes 1RM (Epley: `Gewicht × (1 + Wdh/30)`), meiste Wiederholungen. Hinweis „Neuer PR!“ nach dem Satz.
- **Verlauf pro Übung**: Diagramm für Gewicht bzw. geschätztes 1RM über die Zeit.
- **Volumen & Muskelgruppen**: Volumen (Gewicht × Wdh.) pro Woche, Sätze pro Muskelgruppe.
- **Trainingsfrequenz**: Kalender-Heatmap, Workouts pro Woche, Streak.

### 3.5 Körpergewicht & Körpermaße
- Gewicht eintragen (täglich oder nach Bedarf), Verlaufsdiagramm mit **gleitendem 7-Tage-Durchschnitt**.
- **Zielgewicht** mit Fortschrittsanzeige.
- **Körpermaße** (Brust, Bauch, Arm, Oberschenkel …) und **Körperfettanteil**, jeweils mit Verlauf.

### 3.6 Freunde
- Freunde hinzufügen (per Benutzername oder Einladungscode).
- **Feed**: abgeschlossene Workouts und neue Rekorde der Freunde, nur zum Ansehen (keine Likes, keine Kommentare).
- **Pläne teilen**.
- **Privatsphäre pro Bereich einstellbar**: Workouts / Rekorde / Körpergewicht / Körpermaße jeweils „Freunde“ oder „Nur ich“.

### 3.7 Konto
- Registrierung mit E-Mail + Passwort über Supabase Auth. Das ist in Expo Go am einfachsten. Google/Apple-Login kann später dazukommen.
- Profil: Name, Benutzername, Einheiten (kg).

## 4. JSON-Format für Trainingspläne

```json
{
  "format": "train-plan",
  "version": 1,
  "name": "Push / Pull / Legs",
  "description": "3er-Split, jeder Tag 1x pro Woche",
  "days": [
    {
      "name": "Push",
      "weekday": "monday",
      "exercises": [
        { "exercise_id": "bench_press", "sets": 3, "reps": "8-10" },
        { "exercise_id": "overhead_press", "sets": 3, "reps": "8-10" },
        { "exercise_id": "triceps_pushdown", "sets": 3, "reps": "12" }
      ]
    },
    {
      "name": "Pull",
      "weekday": "wednesday",
      "exercises": [
        { "exercise_id": "pull_up", "sets": 3, "reps": "6-8" },
        { "exercise_id": "barbell_row", "sets": 3, "reps": "8-10" }
      ]
    },
    {
      "name": "Legs",
      "weekday": "friday",
      "exercises": [
        { "exercise_id": "squat", "sets": 4, "reps": "6-8" },
        { "custom_name": "Hip Thrust Maschine", "sets": 3, "reps": "10-12" }
      ]
    }
  ]
}
```

Regeln:
- `exercise_id` muss im Katalog existieren. Alternativ legt `custom_name` beim Import eine eigene Übung an.
- `reps` ist ein Text: eine Zahl (`"12"`) oder ein Bereich (`"8-10"`).
- `weekday` ist optional (`monday` … `sunday`).
- `version` erlaubt spätere Erweiterungen (z. B. Zielgewichte, mehrwöchige Phasen, Pausenzeiten), ohne dass alte Pläne ungültig werden.

**KI-Prompt-Vorlage:** In der App gibt es einen Button „Prompt für KI kopieren“. Er kopiert eine Anleitung mit dem Format und der vollständigen Liste der Übungs-IDs in die Zwischenablage. Die fügt man bei ChatGPT/Claude ein und schreibt dazu, was für einen Plan man möchte.

## 5. Datenmodell (Supabase / Postgres)

| Tabelle | Wichtige Felder |
|---|---|
| `profiles` | id, username, display_name, privacy_workouts, privacy_records, privacy_bodyweight, privacy_measurements |
| `exercises` | id, name, primary_muscle, secondary_muscles, owner_id (null = Katalog) |
| `plans` | id, owner_id, name, description, source_json, status (active/archived), created_at |
| `plan_days` | id, plan_id, name, weekday, position |
| `plan_exercises` | id, plan_day_id, exercise_id, sets, reps, position |
| `workouts` | id, user_id, plan_day_id (optional), started_at, finished_at, note |
| `workout_sets` | id, workout_id, exercise_id, set_number, weight_kg, reps, is_warmup |
| `body_weights` | id, user_id, date, weight_kg |
| `body_measurements` | id, user_id, date, type (chest, waist, arm, …, body_fat), value |
| `goals` | user_id, target_weight_kg |
| `friendships` | user_id, friend_id, status (pending/accepted) |

- Rekorde und Statistiken werden aus `workout_sets` berechnet (nur Sätze mit `is_warmup = false`) und nicht separat gespeichert.
- „Letztes gleiches Training“ heißt: das letzte Workout mit derselben `plan_day_id`. Für jede Übung werden dessen Sätze geladen, Aufwärmsätze inklusive (sie bleiben als Aufwärmsätze markiert).
- Sicherheit über **Row Level Security** in Supabase: Jeder sieht seine eigenen Daten. Freunde sehen nur die Bereiche, die laut Privatsphäre-Einstellung freigegeben sind.

## 6. Screens

1. **Login / Registrierung**
2. **Heute** (Startseite): heutiger Trainingstag, „Training starten“, Kurzstatistik der Woche
3. **Aktives Training**: Übungen mit vorausgefüllten Sätzen, Bestätigen/Ändern, Übung tauschen/hinzufügen, Abschließen
4. **Pläne**: Liste, Import (JSON einfügen), Prompt kopieren, Wochenkalender, Teilen
5. **Fortschritt**: Rekorde, Verlauf pro Übung, Volumen/Muskelgruppen, Heatmap
6. **Körper**: Gewicht + Ziel, Körpermaße, KFA
7. **Freunde**: Feed, Freunde hinzufügen, Anfragen
8. **Profil & Einstellungen**: Privatsphäre, Konto

Navigation: Tab-Leiste unten mit Heute · Pläne · Fortschritt · Körper · Freunde. Profil über ein Icon oben rechts.

App-Name: **train**

Design: modern mit Dark Mode und Akzentfarbe, große Touch-Flächen für die Bedienung mit verschwitzten Händen, Diagramme z. B. mit `victory-native`.

## 7. Roadmap

**Phase 0: Setup (1. Woche)**
Node.js, Expo-Projekt, Expo Go auf dem Handy, Supabase-Projekt anlegen, erste Seite auf dem Handy sehen.

**Phase 1: MVP nur für mich**
Login → Übungskatalog → JSON-Import → Training durchführen mit Vorwerten → Verlauf ansehen.
*Ziel: Die App ersetzt im Gym mein bisheriges Notieren.*

**Phase 2: Auswertung**
Rekorde, Diagramme pro Übung, Volumen/Muskelgruppen, Heatmap, Wochenkalender.

**Phase 3: Körper**
Körpergewicht mit Trend und Ziel, Körpermaße, KFA.

**Phase 4: Freunde**
Freundschaften, Privatsphäre-Einstellungen + Row Level Security, Feed, Pläne teilen. Freunde per Expo-Testlink einladen.

**Phase 5: Feinschliff & Extras (optional)**
Design-Politur, Offline-Sync, Datenexport, Apple Health / Google Fit, Zielgewichte und Phasen im Plan-Format (Version 2), Pausen-Timer, App-Store-Veröffentlichung.

## 8. Getroffene Entscheidungen

- App-Name: **train**
- Gewicht: frei eintippen, keine festen Schritte
- Aufwärmsätze: markierbar, zählen nicht in Statistiken und Rekorden
- Freunde: nur ansehen, keine Likes oder Kommentare
- Sätze: Es zählt nur, was eingetragen ist, ohne „nicht geschafft“-Status
- Übungskatalog: ca. 50 gängige Übungen zum Start, eigene ergänzbar
- Pläne: werden archiviert statt gelöscht und können später wieder aufgenommen werden; Workouts bleiben immer erhalten

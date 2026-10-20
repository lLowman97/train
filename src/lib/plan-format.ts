// The "train-plan" JSON format (see docs/konzept.md, section 4): parsing,
// validation and the prompt that teaches an AI to write it.

export const PLAN_FORMAT = 'train-plan';
export const PLAN_FORMAT_VERSION = 1;

export type CatalogExercise = {
  id: string;
  name: string;
  primary_muscle: string | null;
};

/** Normalized plan, ready for the import_plan database function. */
export type ImportPlan = {
  name: string;
  description: string | null;
  days: ImportDay[];
};

export type ImportDay = {
  name: string;
  weekday: number | null; // 1 = Monday ... 7 = Sunday
  exercises: ImportExercise[];
};

export type ImportExercise =
  | { exercise_id: string; name: string; sets: number; reps: string }
  | { custom_name: string; primary_muscle: string | null; name: string; sets: number; reps: string };

export type ParseResult =
  | { ok: true; plan: ImportPlan; source: unknown; warnings: string[] }
  | { ok: false; errors: string[] };

const WEEKDAYS: Record<string, number> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
  montag: 1, dienstag: 2, mittwoch: 3, donnerstag: 4, freitag: 5, samstag: 6, sonntag: 7,
};

export const WEEKDAY_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const MUSCLES = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms',
  'quads', 'hamstrings', 'glutes', 'calves', 'abs',
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/** Accepts 8, "8", "8-10" and "8–10"; returns "8" or "8-10". */
function parseReps(value: unknown): string | null {
  const text = typeof value === 'number' ? String(value) : typeof value === 'string' ? value : null;
  if (text === null) return null;
  const normalized = text.replace(/\s/g, '').replace(/[–—]/g, '-');
  const match = /^(\d+)(?:-(\d+))?$/.exec(normalized);
  if (!match) return null;
  const min = Number(match[1]);
  const max = match[2] === undefined ? null : Number(match[2]);
  if (min < 1 || (max !== null && max < min)) return null;
  return max === null || max === min ? String(min) : `${min}-${max}`;
}

/** AIs like to wrap JSON in a ```json code block, so strip that first. */
function extractJson(text: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (fenced ? fenced[1] : text).trim();
}

export function parsePlan(text: string, exercises: CatalogExercise[]): ParseResult {
  let source: unknown;
  try {
    source = JSON.parse(extractJson(text));
  } catch {
    return {
      ok: false,
      errors: ['Das ist kein gültiges JSON. Kopiere die Antwort der KI vollständig, von { bis }.'],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isObject(source)) {
    return { ok: false, errors: ['Der Plan muss ein JSON-Objekt sein, das mit { beginnt.'] };
  }
  if (source.format !== undefined && source.format !== PLAN_FORMAT) {
    errors.push(`Unbekanntes Format "${String(source.format)}", erwartet wird "${PLAN_FORMAT}".`);
  }
  if (typeof source.version === 'number' && source.version > PLAN_FORMAT_VERSION) {
    errors.push(`Der Plan nutzt Version ${source.version}, die App kennt nur Version ${PLAN_FORMAT_VERSION}.`);
  }

  const name = nonEmptyString(source.name);
  if (!name) errors.push('Der Plan braucht einen Namen ("name").');
  const description = nonEmptyString(source.description);

  const byId = new Map(exercises.map((e) => [e.id, e]));
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e]));

  const days: ImportDay[] = [];
  if (!Array.isArray(source.days) || source.days.length === 0) {
    errors.push('Der Plan braucht mindestens einen Trainingstag ("days").');
  } else {
    source.days.forEach((rawDay, dayIndex) => {
      const dayLabel = `Tag ${dayIndex + 1}`;
      if (!isObject(rawDay)) {
        errors.push(`${dayLabel}: muss ein Objekt sein.`);
        return;
      }
      const dayName = nonEmptyString(rawDay.name);
      const label = dayName ? `${dayLabel} (${dayName})` : dayLabel;
      if (!dayName) errors.push(`${dayLabel}: braucht einen Namen ("name").`);

      let weekday: number | null = null;
      if (rawDay.weekday !== undefined && rawDay.weekday !== null) {
        weekday = WEEKDAYS[String(rawDay.weekday).trim().toLowerCase()] ?? null;
        if (weekday === null) {
          errors.push(`${label}: unbekannter Wochentag "${String(rawDay.weekday)}" (z. B. "monday").`);
        }
      }

      const dayExercises: ImportExercise[] = [];
      if (!Array.isArray(rawDay.exercises) || rawDay.exercises.length === 0) {
        errors.push(`${label}: braucht mindestens eine Übung ("exercises").`);
      } else {
        rawDay.exercises.forEach((rawEx, exIndex) => {
          const exLabel = `${label}, Übung ${exIndex + 1}`;
          if (!isObject(rawEx)) {
            errors.push(`${exLabel}: muss ein Objekt sein.`);
            return;
          }

          const sets = rawEx.sets;
          const setsOk = typeof sets === 'number' && Number.isInteger(sets) && sets >= 1 && sets <= 20;
          if (!setsOk) errors.push(`${exLabel}: "sets" muss eine ganze Zahl von 1 bis 20 sein.`);
          const reps = parseReps(rawEx.reps);
          if (!reps) errors.push(`${exLabel}: "reps" muss eine Zahl oder ein Bereich wie "8-10" sein.`);

          const id = nonEmptyString(rawEx.exercise_id);
          const customName = nonEmptyString(rawEx.custom_name);
          const muscle = nonEmptyString(rawEx.primary_muscle);
          if (!id && !customName) {
            errors.push(`${exLabel}: braucht "exercise_id" oder "custom_name".`);
            return;
          }
          if (!setsOk || !reps) return;

          // Known ID, or the AI used a catalog name instead of the ID.
          const known = id ? (byId.get(id) ?? byName.get(id.toLowerCase())) : byName.get(customName!.toLowerCase());
          if (known) {
            dayExercises.push({ exercise_id: known.id, name: known.name, sets: sets as number, reps });
            return;
          }

          const newName = customName ?? id!;
          if (id) warnings.push(`"${id}" ist nicht im Katalog und wird als eigene Übung angelegt.`);
          dayExercises.push({
            custom_name: newName,
            primary_muscle: muscle && MUSCLES.includes(muscle) ? muscle : null,
            name: newName,
            sets: sets as number,
            reps,
          });
        });
      }

      days.push({ name: dayName ?? dayLabel, weekday, exercises: dayExercises });
    });
  }

  if (errors.length > 0 || !name) return { ok: false, errors };
  return { ok: true, plan: { name, description, days }, source, warnings: [...new Set(warnings)] };
}

/** Prompt to paste into ChatGPT/Claude, followed by the user's wishes. */
export function buildAiPrompt(exercises: CatalogExercise[]): string {
  const catalog = exercises
    .map((e) => `${e.id}: ${e.name}${e.primary_muscle ? ` (${e.primary_muscle})` : ''}`)
    .join('\n');

  return `Erstelle mir einen Trainingsplan für meine Gym-App "train". Antworte ausschließlich mit JSON in genau diesem Format, ohne weiteren Text:

{
  "format": "${PLAN_FORMAT}",
  "version": ${PLAN_FORMAT_VERSION},
  "name": "Name des Plans",
  "description": "Kurze Beschreibung",
  "days": [
    {
      "name": "Name des Trainingstags, z. B. Push",
      "weekday": "monday",
      "exercises": [
        { "exercise_id": "bench_press", "sets": 3, "reps": "8-10" },
        { "custom_name": "Name einer Übung, die nicht in der Liste steht", "primary_muscle": "glutes", "sets": 3, "reps": "12" }
      ]
    }
  ]
}

Regeln:
- "exercise_id" muss aus der Liste unten stammen. Nur wenn keine passende Übung existiert, "custom_name" statt "exercise_id" verwenden und "primary_muscle" angeben (eins von: ${MUSCLES.join(', ')}).
- "sets" ist eine ganze Zahl, "reps" ist eine Zahl als Text ("12") oder ein Bereich ("8-10").
- "weekday" ist optional: monday, tuesday, wednesday, thursday, friday, saturday oder sunday.
- Keine Gewichte, Pausenzeiten oder sonstigen Felder angeben.

Verfügbare Übungen (exercise_id: Name):
${catalog}

Meine Wünsche an den Plan:
`;
}

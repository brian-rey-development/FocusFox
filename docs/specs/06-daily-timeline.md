---
title: Daily Timeline
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Daily Timeline

Per-day chronological feed of user notes and engine-generated auto entries, rendered on the dashboard's "Hoy" tab and accessible via quick-add from the popup. User notes are full CRUD; auto entries are read-only records written by the Pomodoro engine and distraction service. All entries are keyed to a calendar day in the user's local timezone.

## Depends on

- `01-data-model` - `NoteEntry` type, `notes` object store, DB layer (`addNote`, `listNotesForDay`, `updateNote`, `deleteNote`).
- `03-pomodoro-engine` - emits `pomodoro.completed`, `pomodoro.cancelled`, `pomodoro.state_change` events that trigger auto entries.
- `05-distraction-tracking` - emits `distraction.manual` events that trigger auto entries.

## Used by

- `09-ui-dashboard` - "Hoy" tab renders the full day feed.
- `08-ui-popup` - quick-add input creates user notes without opening the dashboard.

## Day Key Derivation

All entries are assigned `day = dayKey(at)` at write time using the shared helper:

```ts
// shared/time.ts  (from spec 01, reproduced for clarity)
export function dayKey(at: number): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

Day boundary is local midnight. An entry timestamped 23:59:59 belongs to that day; one at 00:00:01 the next calendar day belongs to the new day. The `day` field is derived - never passed in by the caller; it is always computed from `at` inside the service.

## NoteEntry Type

Defined in `01-data-model`. Reproduced here for readability:

```ts
interface NoteEntry {
  id: string;               // ulid
  day: string;              // YYYY-MM-DD local timezone, derived from at
  at: number;               // ms epoch
  kind: 'user' | 'auto';
  text: string;
  refType: 'pomodoro' | 'distraction' | null;
  refId: string | null;
}
```

## Service API

Lives in `src/background/services/timeline.ts`. Wraps the DB layer with validation, day key derivation, and event broadcast.

```ts
class TimelineService {
  async addUserNote(input: { text: string }): Promise<NoteEntry>;

  async updateUserNote(id: string, text: string): Promise<NoteEntry>;

  async deleteUserNote(id: string): Promise<void>;

  async writeAutoEntry(
    input: Omit<NoteEntry, 'id' | 'day' | 'kind'> & { kind: 'auto' }
  ): Promise<NoteEntry>;

  async listDay(day: string): Promise<NoteEntry[]>;
}
```

### addUserNote

1. Trim `input.text`. Reject if trimmed length is outside `[1, 1000]` - return `invalid_text`.
2. Set `at = Date.now()`, `day = dayKey(at)`, `kind = 'user'`, `refType = null`, `refId = null`.
3. Call `db.addNote(...)`. Return the persisted `NoteEntry`.
4. Broadcast `notes.changed { day }`.

### updateUserNote

1. Fetch entry by `id`. If missing, return `not_found`.
2. If `kind !== 'user'`, return `not_user_note`. Auto entries are immutable via this path.
3. Trim `text`. Reject if trimmed length is outside `[1, 1000]` - return `invalid_text`.
4. Call `db.updateNote(id, { text: trimmed })`. Return updated entry.
5. Broadcast `notes.changed { day: entry.day }`.

### deleteUserNote

1. Fetch entry by `id`. If missing, return `not_found`.
2. If `kind !== 'user'`, return `not_user_note`.
3. Call `db.deleteNote(id)`.
4. Broadcast `notes.changed { day: entry.day }`.

### writeAutoEntry

Called only by other background services (Pomodoro engine, distraction service). Never called from a UI message directly.

1. Set `day = dayKey(input.at)`, `kind = 'auto'`.
2. Call `db.addNote(...)`. Return the persisted `NoteEntry`.
3. Broadcast `notes.changed { day }`.

### listDay

1. Call `db.listNotesForDay(day)`.
2. Sort by `at` ascending before returning (DB index order is a best-effort; enforce sort here).
3. Return the sorted array.

## Auto Entry Templates

The Pomodoro engine and distraction service call `timelineService.writeAutoEntry(...)` at the points listed below.

### Pomodoro Engine Events

| Event | Condition | Text template | refType | refId |
|---|---|---|---|---|
| `pomodoro.completed` | work pomodoro ends fully | `Completed work pomodoro on {taskTitle} ({duration}m, {n} distractions)` | `'pomodoro'` | `pomodoroId` |
| `pomodoro.cancelled` | work pomodoro cancelled | `Cancelled work pomodoro on {taskTitle} after {actualDuration}m` | `'pomodoro'` | `pomodoroId` |
| `pomodoro.state_change` -> `short_break` | transition into short break | `Short break (5m)` | `null` | `null` |
| `pomodoro.state_change` -> `long_break` | transition into long break | `Long break (15m)` | `null` | `null` |

Notes on template fields:
- `{taskTitle}` - the task title at the moment of the event (snapshot, not a live reference).
- `{duration}` - `Math.round(plannedDurationMs / 60_000)`.
- `{actualDuration}` - `Math.round((endedAt - startedAt) / 60_000)`, minimum 1.
- `{n}` - `distractionCount` from the `Pomodoro` record.
- Break duration values (`5m`, `15m`) come from the settings at the time of the state change, not hardcoded literals. Format: `${Math.round(breakMs / 60_000)}m`.

Break entries for `short_break` and `long_break` do NOT set `refType` or `refId` because the break itself is not a distinct DB record; it is a phase of the engine state.

Only **work** pomodoro completions and cancellations write entries. Break start writes an entry, but break end does NOT write an entry (avoids double noise - the next work-start or the completed-work entry already marks the boundary).

### Distraction Service Events

| Trigger | Text template | refType | refId |
|---|---|---|---|
| Manual distraction with `reason` | `Distraction: {reason}` (reason trimmed) | `'distraction'` | `distractionId` |
| Manual distraction without `reason` | `Distraction recorded` | `'distraction'` | `distractionId` |

Auto-blocked navigation attempts do **not** create timeline entries. They are high-frequency noise and appear only in stats. Only explicit manual distraction calls (`distraction.manual`) write to the timeline.

## Messages Handled

```ts
type TimelineRequest =
  | { kind: 'notes.add'; text: string }
  | { kind: 'notes.update'; id: string; text: string }
  | { kind: 'notes.delete'; id: string }
  | { kind: 'notes.listDay'; day: string };
```

### Response shapes

```ts
// notes.add
| { ok: true; note: NoteEntry }
| { ok: false; error: 'invalid_text' }

// notes.update
| { ok: true; note: NoteEntry }
| { ok: false; error: 'not_found' | 'not_user_note' | 'invalid_text' }

// notes.delete
| { ok: true }
| { ok: false; error: 'not_found' | 'not_user_note' }

// notes.listDay
| { ok: true; items: NoteEntry[] }
```

## Events Broadcast

After any successful mutation the background broadcasts via `browser.runtime.sendMessage` to all extension pages:

```ts
{ kind: 'notes.changed'; day: string }
```

Open UIs subscribe with `browser.runtime.onMessage` and re-fetch `notes.listDay` for the affected day. No payload beyond `day` is sent - UIs pull, they do not receive pushed diffs.

## UI Integration

The following rendering rules are specified here because they originate from data contracts defined in this spec. Implementation lives in `09-ui-dashboard` (Today tab) and `08-ui-popup` (quick-add input).

### Feed item appearance

| kind | dot color | pill label | actions |
|---|---|---|---|
| `auto`, `refType='pomodoro'` (work) | amber | `pomodoro completado` or `pomodoro cancelado` | none |
| `auto`, `refType=null` (break) | green | `descanso` | none |
| `auto`, `refType='distraction'` | red | `distraccion` | none |
| `user` | blue | `tu nota` | edit, delete (kebab menu) |

Auto entries render without edit or delete affordances. The kebab menu is only shown for `kind === 'user'`.

### Quick-add input

- Displayed at the top of the "Hoy" tab in the dashboard and as a compact field in the popup.
- Pressing `Enter` (or clicking a submit button) sends `notes.add { text }`.
- Field clears on successful submission.
- Inline error shown if `error === 'invalid_text'`.

### Empty state

When `listDay` returns an empty array for today, display:

> "Aun no hay registros de hoy. Empezar un pomodoro o anotar algo?"

## Acceptance

- Adding a user note via `notes.add` creates a `NoteEntry` with `kind = 'user'`, `day = dayKey(Date.now())`, and `at` approximately equal to the call time.
- `notes.add` with empty string or a string of 1001+ characters after trimming returns `{ ok: false, error: 'invalid_text' }`.
- `notes.add` with exactly 1000 characters after trimming succeeds.
- `notes.update` on an entry with `kind = 'auto'` returns `{ ok: false, error: 'not_user_note' }`.
- `notes.update` on a non-existent id returns `{ ok: false, error: 'not_found' }`.
- `notes.delete` on a `kind = 'auto'` entry returns `{ ok: false, error: 'not_user_note' }`.
- Completing a work pomodoro causes exactly one auto `NoteEntry` to be written, whose text matches the template `Completed work pomodoro on {taskTitle} (...)` with correct `refType = 'pomodoro'` and `refId = pomodoroId`.
- Cancelling a work pomodoro causes exactly one auto `NoteEntry` whose text starts with `Cancelled work pomodoro on`.
- A state transition to `short_break` causes exactly one auto `NoteEntry` whose text starts with `Short break`.
- A state transition to `long_break` causes exactly one auto `NoteEntry` whose text starts with `Long break`.
- A manual distraction with `reason = "checked Twitter"` creates one auto `NoteEntry` with text `Distraction: checked Twitter` (trimmed).
- A manual distraction without a reason creates one auto `NoteEntry` with text `Distraction recorded`.
- Auto-blocked navigation attempts do NOT create any `NoteEntry`.
- `notes.listDay` returns all entries for the requested day ordered by `at` ascending, with no entries from adjacent days.
- An entry created at 23:59:59 local time belongs to that calendar day. An entry created at 00:00:01 the next day belongs to the new day.
- After any mutation, a `notes.changed { day }` broadcast is sent and an open UI that refetches `notes.listDay` sees the updated list.
- Vitest suite covers: auto entry template formatting for all four Pomodoro events, distraction templates with and without reason, `invalid_text` validation boundaries (0, 1, 1000, 1001 chars), `not_user_note` guard, and `listDay` sort order with multiple entries.

## Out of scope

- Rich text or markdown in note content.
- Search or filter within the timeline.
- Multi-day journal view or date navigation beyond the current day in the popup.
- Attachments, images, or file references.
- Tags on user notes.
- Sharing or exporting individual notes.
- AI-generated summaries or insights.
- Pinning or starring entries.
- Inline links or URL detection.

---
title: Data Model and Storage
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Data Model and Storage

IndexedDB schema, TypeScript types, migrations, and the DB access layer that all other modules use.

## Library

`idb` (Jake Archibald's wrapper). Promise-based, type-safe, ~3 KB gzipped. No raw `IDBDatabase` calls anywhere except inside `src/background/db/`.

## Database

- Name: `focusfox`
- Initial version: `1`
- Single DB, multiple object stores below.

## Stores

### `projects`

```ts
interface Project {
  id: string;            // ulid
  name: string;          // 1..80 chars
  color: ProjectColor;   // see palette
  createdAt: number;     // ms epoch
  archived: boolean;
}

type ProjectColor = 'blue' | 'amber' | 'green' | 'purple' | 'red' | 'cyan';
```

- Key path: `id`
- Indexes: `by_archived` on `archived`

### `tasks`

```ts
interface Task {
  id: string;
  projectId: string;
  title: string;                   // 1..200 chars
  status: 'todo' | 'doing' | 'done';
  estimatedPomodoros: number | null;
  completedPomodoros: number;      // increments on completed work pomodoro
  createdAt: number;
  updatedAt: number;
  doneAt: number | null;
}
```

- Key path: `id`
- Indexes: `by_project` on `projectId`, `by_status` on `status`

### `pomodoros`

```ts
interface Pomodoro {
  id: string;
  taskId: string;
  projectId: string;
  kind: 'work' | 'short_break' | 'long_break';
  startedAt: number;
  endedAt: number | null;          // null while running
  plannedDurationMs: number;
  completedFully: boolean;         // false if cancelled
  distractionCount: number;        // denormalized count for fast reads
  cycleIndex: number;              // 1..longBreakEvery within the day
}
```

- Key path: `id`
- Indexes: `by_task` on `taskId`, `by_project` on `projectId`, `by_started` on `startedAt`, `by_day` on derived day key (see below)

### `distractions`

```ts
interface Distraction {
  id: string;
  pomodoroId: string;
  type: 'auto_blocked_attempt' | 'manual';
  url: string | null;              // for auto
  domain: string | null;           // for auto, used for dedupe
  reason: string | null;           // for manual
  at: number;
}
```

- Key path: `id`
- Indexes: `by_pomodoro` on `pomodoroId`, `by_at` on `at`

### `notes`

```ts
interface NoteEntry {
  id: string;
  day: string;                     // YYYY-MM-DD local timezone
  at: number;
  kind: 'user' | 'auto';
  text: string;
  refType: 'pomodoro' | 'distraction' | null;
  refId: string | null;
}
```

- Key path: `id`
- Indexes: `by_day` on `day`, `by_at` on `at`

### `settings`

Single-row store keyed by literal string `'default'`.

```ts
interface Settings {
  id: 'default';
  workMs: number;                  // default 25 * 60_000
  shortBreakMs: number;            // default 5 * 60_000
  longBreakMs: number;             // default 15 * 60_000
  longBreakEvery: number;          // default 4
  autoStartBreaks: boolean;        // default true
  autoStartNextWork: boolean;      // default false
  allowlist: string[];             // domains, e.g. ['github.com', 'docs.python.org']
}
```

### `meta`

Keyed by string. Used for migrations and engine state persistence.

```ts
interface MetaRow {
  key: string;
  value: unknown;
}
```

Reserved keys:
- `schemaVersion`
- `engineState` - serialized current pomodoro state for crash recovery (see spec 03)

## Day key derivation

```ts
// shared/time.ts
export function dayKey(at: number, tz: string = 'local'): string {
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
```

Day boundary is local midnight. The `by_day` index on `pomodoros` is computed at write time and stored as a derived field `dayKey`.

## DB layer API

```ts
// src/background/db/index.ts
export interface DB {
  // projects
  listProjects(opts?: { includeArchived?: boolean }): Promise<Project[]>;
  createProject(input: Omit<Project, 'id' | 'createdAt' | 'archived'>): Promise<Project>;
  updateProject(id: string, patch: Partial<Project>): Promise<Project>;
  archiveProject(id: string): Promise<void>;

  // tasks
  listTasks(projectId: string): Promise<Task[]>;
  createTask(input: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'doneAt' | 'completedPomodoros' | 'status'> & { status?: Task['status'] }): Promise<Task>;
  updateTask(id: string, patch: Partial<Task>): Promise<Task>;
  incrementCompletedPomodoros(taskId: string): Promise<void>;

  // pomodoros
  startPomodoro(input: Omit<Pomodoro, 'id' | 'endedAt' | 'completedFully' | 'distractionCount'>): Promise<Pomodoro>;
  finishPomodoro(id: string, endedAt: number, completedFully: boolean): Promise<Pomodoro>;
  getPomodoro(id: string): Promise<Pomodoro | null>;
  listPomodorosForDay(day: string): Promise<Pomodoro[]>;
  listPomodorosForRange(fromDay: string, toDay: string): Promise<Pomodoro[]>;

  // distractions
  addDistraction(input: Omit<Distraction, 'id'>): Promise<Distraction>;
  listDistractionsForPomodoro(pomodoroId: string): Promise<Distraction[]>;
  recentAutoDistractionForDomain(pomodoroId: string, domain: string, withinMs: number): Promise<Distraction | null>;

  // notes
  addNote(input: Omit<NoteEntry, 'id'>): Promise<NoteEntry>;
  listNotesForDay(day: string): Promise<NoteEntry[]>;
  deleteNote(id: string): Promise<void>;
  updateNote(id: string, patch: Partial<NoteEntry>): Promise<NoteEntry>;

  // settings
  getSettings(): Promise<Settings>;
  updateSettings(patch: Partial<Settings>): Promise<Settings>;

  // meta
  getMeta<T = unknown>(key: string): Promise<T | null>;
  setMeta<T = unknown>(key: string, value: T): Promise<void>;
}
```

Implementation uses transactions per call. No long-lived transactions across awaits.

## Migrations

Migrations live in `src/background/db/migrations.ts`. The `upgrade` callback of `idb` dispatches by version.

```ts
function migrate(db: IDBPDatabase, oldVersion: number, newVersion: number) {
  if (oldVersion < 1) v1_initial(db);
  // future: if (oldVersion < 2) v2_addTagsStore(db);
}
```

`v1_initial` creates all stores and indexes listed above and seeds `settings` with defaults if missing.

## Export / import payload

```ts
interface ExportPayload {
  formatVersion: 1;
  exportedAt: number;
  data: {
    projects: Project[];
    tasks: Task[];
    pomodoros: Pomodoro[];
    distractions: Distraction[];
    notes: NoteEntry[];
    settings: Settings;
  };
}
```

Import behavior:
- Reject if `formatVersion` is unknown.
- Default mode: replace all data.
- Future: merge mode (out of scope for MVP).

## ID generation

`ulid` package. Sortable, URL-safe, no collisions in practice.

## Acceptance

- `idb.open('focusfox', 1, { upgrade: migrate })` runs without errors on a fresh profile and creates all stores with the documented indexes.
- Default settings are seeded on first run.
- All DB layer methods covered by Vitest unit tests using `fake-indexeddb`.
- Export -> wipe DB -> import round-trips byte-for-byte equivalent payload.

## Out of scope

- Multi-DB support, multi-profile.
- Encrypted storage.
- Schema versioning beyond v1.
- Sync logic.

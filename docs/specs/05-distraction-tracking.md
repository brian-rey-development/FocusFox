---
title: Distraction Tracking
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Distraction Tracking

Service that records distractions from two sources - automatic blocked-attempt events emitted by the focus blocker and manual entries logged by the user - then exposes a live per-session counter and per-pomodoro list to the rest of the system.

## Depends on

- `01-data-model` - `Distraction`, `NoteEntry`, DB layer (`addDistraction`, `listDistractionsForPomodoro`, `recentAutoDistractionForDomain`, `addNote`).
- `03-pomodoro-engine` - engine state (must be `'work'` for manual entries), active `pomodoroId`, `distractionCountSession` field on tick payload, `pomodoro.started` event.
- `04-focus-blocking` - emits `focus.blocked_attempt` events consumed here as the trigger for auto recording.

## Used by

- `06-daily-timeline` - manual entries surface in the daily timeline via the auto-created `NoteEntry`.
- `07-stats` - reads `Pomodoro.distractionCount` (denormalized from this service) for aggregated counts.
- `08-ui-popup` - displays live `distractionCountSession` via the tick stream.
- `10-ui-blocked-page` - displays live `distractionCountSession` via port subscription.

## Distraction types

### `auto_blocked_attempt`

Triggered when the focus blocker intercepts a navigation to a blocked domain and emits `focus.blocked_attempt`. The resulting `Distraction` row captures:

```ts
{
  type: 'auto_blocked_attempt',
  pomodoroId: string,   // active pomodoro at the moment of the attempt
  url: string,          // full URL of the blocked request
  domain: string,       // effective domain, used for dedupe
  reason: null,
  at: number,           // ms epoch
}
```

Auto distractions do NOT produce a `NoteEntry`. They appear only in per-pomodoro stats.

### `manual`

Triggered by the `distraction.manual` message from any UI surface. Valid only during the `'work'` state.

```ts
{
  type: 'manual',
  pomodoroId: string,   // active pomodoro
  url: null,
  domain: null,
  reason: string | null,  // trimmed user text or null if empty
  at: number,
}
```

Manual distractions create an accompanying `NoteEntry` so they appear in the daily timeline.

## Service API

```ts
// src/background/services/distractions.ts

class DistractionService {
  // Called by the blocked_attempt listener. Returns null if deduped.
  async recordAuto(input: { url: string; domain: string }): Promise<Distraction | null>;

  // Called by the message router for distraction.manual.
  // Throws typed errors if state is not 'work' or reason is invalid.
  async recordManual(input: { reason?: string }): Promise<Distraction>;

  // Used by the engine on finishPomodoro to compute distractionCount.
  async listForPomodoro(pomodoroId: string): Promise<Distraction[]>;

  // Returns the in-memory session counter. Cheap, no DB call.
  getSessionCount(): number;
}
```

## Dedupe logic (auto only)

Before persisting an `auto_blocked_attempt`, check if a row with the same `domain` and `pomodoroId` was written in the last 30 seconds:

```
async recordAuto(input):
  pomodoroId = engine.currentPomodoroId()
  if pomodoroId is null -> return null

  existing = await DB.recentAutoDistractionForDomain(pomodoroId, input.domain, 30_000)
  if existing is not null -> return null   // dedupe: drop silently

  distraction = await DB.addDistraction({
    type: 'auto_blocked_attempt',
    pomodoroId,
    url: input.url,
    domain: input.domain,
    reason: null,
    at: Date.now(),
  })

  engine.distractionCountSession += 1
  broadcast({ kind: 'distraction.added', distraction })
  return distraction
```

Dedupe is scoped to the same `pomodoroId`. A blocked attempt after a new pomodoro starts is always a fresh record even if the domain was seen before.

## Manual validation and constraints

```
async recordManual(input):
  if engine.state !== 'work' -> throw { code: 'no_active_pomodoro' }

  pomodoroId = engine.currentPomodoroId()   // guaranteed non-null when state is 'work'

  reason = input.reason?.trim() ?? ''
  if reason.length > 200 -> throw { code: 'invalid_reason' }
  normalizedReason = reason.length > 0 ? reason : null

  distraction = await DB.addDistraction({
    type: 'manual',
    pomodoroId,
    url: null,
    domain: null,
    reason: normalizedReason,
    at: Date.now(),
  })

  noteText = normalizedReason
    ? `Distraction: ${normalizedReason}`
    : 'Distraction recorded'

  await DB.addNote({
    day: dayKey(distraction.at),
    at: distraction.at,
    kind: 'auto',
    text: noteText,
    refType: 'distraction',
    refId: distraction.id,
  })

  engine.distractionCountSession += 1
  broadcast({ kind: 'distraction.added', distraction })
  return distraction
```

Error codes are returned as typed response objects by the message router, never thrown across the message bus.

## Session counter

`distractionCountSession` is an in-memory integer held on the engine instance.

- Initialized to `0` when the engine module loads.
- Incremented by `1` on every persisted distraction (auto or manual).
- Reset to `0` when the engine processes a `pomodoro.started` event (i.e., at the moment a new work pomodoro begins, not at break start).
- Included verbatim in every `Tick` payload sent over the popup port (spec 03).

```ts
// Excerpt - engine fields
interface EngineState {
  state: 'idle' | 'work' | 'short_break' | 'long_break';
  currentPomodoroId: string | null;
  distractionCountSession: number;
  // ...other engine fields
}
```

## Event subscriptions (background)

The service registers two internal listeners on the background event bus at startup:

| Event | Handler |
|---|---|
| `focus.blocked_attempt` `{ url, domain }` | calls `recordAuto({ url, domain })` |
| `pomodoro.started` `{ pomodoroId }` | resets `engine.distractionCountSession = 0` |

Both listeners are attached in `src/background/index.ts` during the initialization sequence, after the engine and blocker are ready.

## Event broadcast (outbound)

After every persisted distraction, the service broadcasts to all connected contexts:

```ts
type DistractionAddedEvent = {
  kind: 'distraction.added';
  distraction: Distraction;
};
```

Delivery: `browser.runtime.sendMessage` to open UIs plus `port.postMessage` to all active long-lived connections (popup port, blocked-page port). UIs update their local Zustand store on receipt.

## Messages handled

```ts
type DistractionRequest =
  | { kind: 'distraction.manual'; reason?: string }
  | { kind: 'distraction.list'; pomodoroId: string }
  | { kind: 'distraction.sessionCount' };
```

Response shapes:

```ts
// distraction.manual
| { ok: true; distraction: Distraction }
| { ok: false; error: 'no_active_pomodoro' | 'invalid_reason' }

// distraction.list
| { ok: true; items: Distraction[] }

// distraction.sessionCount
| { ok: true; count: number }
```

## Pomodoro count denormalization

On `finishPomodoro`, the engine calls:

```ts
const rows = await distractionService.listForPomodoro(pomodoroId);
await DB.finishPomodoro(id, endedAt, completedFully, rows.length);
```

`DB.finishPomodoro` writes `distractionCount: rows.length` onto the `Pomodoro` row in the same transaction as `endedAt` and `completedFully`. This denormalized field is what `07-stats` reads; it avoids a join at query time.

The denormalization happens once per pomodoro, at the moment of finish or cancellation, so `distractionCount` is always the final authoritative count for closed pomodoros.

## Acceptance

- Two consecutive blocked attempts to the same domain within 30 seconds, same active pomodoro, produce exactly one `Distraction` row and increment the session counter by 1.
- Two blocked attempts to different domains within 30 seconds each produce their own row; session counter increments by 2.
- Two blocked attempts to the same domain with 31 seconds between them produce two rows; session counter increments by 2.
- `recordManual` during `'work'` state persists the row, appends a `NoteEntry`, and broadcasts `distraction.added`.
- `recordManual` during `'idle'`, `'short_break'`, or `'long_break'` returns `{ ok: false, error: 'no_active_pomodoro' }` and writes nothing.
- Manual distraction with an empty string or whitespace-only `reason` persists with `reason: null`; the corresponding `NoteEntry.text` is `'Distraction recorded'`.
- Manual distraction with a non-empty reason produces `NoteEntry.text` equal to `'Distraction: <reason>'`.
- Manual distraction with a `reason` longer than 200 characters returns `{ ok: false, error: 'invalid_reason' }` and writes nothing.
- `distractionCountSession` resets to `0` on each `pomodoro.started` event and is unaffected by break transitions.
- After `pomodoro.completed` or `pomodoro.cancelled`, the `Pomodoro.distractionCount` field matches the number of rows in the `distractions` store for that `pomodoroId`.
- Dedupe is not applied to manual distractions: two rapid manual presses create two rows.
- Vitest covers: dedupe boundary at exactly 30 000 ms (same ms is deduped, 30 001 ms is not), session counter reset, manual rejection outside `'work'` state, reason trimming and null normalization.

## Out of scope

- Distraction categories or severity levels.
- ML-based categorization of blocked URLs.
- Custom dedupe windows per domain or user preference.
- Undo / delete a recorded distraction.
- Aggregating auto-blocked attempts into the daily timeline.

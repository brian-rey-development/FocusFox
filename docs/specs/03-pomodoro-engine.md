---
title: Pomodoro Engine
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Pomodoro Engine

The background-side state machine that drives every focus session. It owns the timer, persists its own state for crash recovery, manages the `browser.alarms` wakeup schedule, streams per-second ticks to connected ports, and emits lifecycle events to all open UI surfaces.

## Depends on

- `01-data-model` for `Pomodoro`, `Task`, `Settings`, and the DB layer.
- `02-projects-and-tasks` for task status auto-transition on start and `incrementCompletedPomodoros`.

## Used by

- `04-focus-blocking` (reads current state to decide whether blocking is active).
- `05-distraction-tracking` (attaches distractions to the active `pomodoroId`).
- `06-daily-timeline` (consumes `pomodoro.completed` and `pomodoro.cancelled` to write auto notes).
- `08-ui-popup` (tick stream, start/cancel commands).
- `10-ui-blocked` (reads snapshot to show remaining time).

## State machine

States: `idle | work | short_break | long_break`

```
idle ──pomodoro.start──► work
work ──completed (cycleIndex < longBreakEvery)──► short_break
work ──completed (cycleIndex === longBreakEvery)──► long_break
work ──cancel──► idle
short_break ──completed──► idle  (or ──► work if autoStartNextWork)
long_break  ──completed──► idle  (or ──► work if autoStartNextWork)
short_break ──skipBreak──► idle  (or ──► work if autoStartNextWork)
long_break  ──skipBreak──► idle  (or ──► work if autoStartNextWork)
any ──cancel──► idle
```

Only one state is active at a time. Starting while `state !== 'idle'` returns `{ok: false, error: 'busy'}`.

## Engine state shape

```ts
interface EngineState {
  state: 'idle' | 'work' | 'short_break' | 'long_break';
  pomodoroId: string | null;   // active DB row id
  taskId: string | null;
  startedAt: number | null;    // ms epoch, set on each transition
  plannedDurationMs: number;
  cycleIndex: number;          // 1..longBreakEvery, resets at local midnight
  distractionCountSession: number; // live count for current work interval
}
```

`remainingMs` is always derived, never stored:

```ts
const remainingMs = Math.max(
  0,
  state.plannedDurationMs - (Date.now() - (state.startedAt ?? Date.now()))
);
```

This guarantees zero clock drift across background wakeups.

## Persistence

The engine writes `EngineState` to two locations after every state transition:

1. `browser.storage.local` key `engineState` - fast, in-memory-backed, survives restart.
2. `db.setMeta('engineState', engineState)` - durable, survives extension reinstall.

On startup (`runtime.onStartup`, `runtime.onInstalled`):

```ts
async function hydrateEngineState(): Promise<EngineState> {
  const fast = await browser.storage.local.get('engineState');
  if (fast.engineState) return fast.engineState as EngineState;
  const durable = await db.getMeta<EngineState>('engineState');
  return durable ?? defaultEngineState();
}
```

After hydration, run crash recovery before accepting messages (see below).

## Alarms

Three named alarms, managed via `browser.alarms`:

| Alarm name | Scheduled at | Purpose |
|---|---|---|
| `pomodoro_transition` | `startedAt + plannedDurationMs` | Fire state completion when popup is closed |
| `daily_reset` | next local midnight | Reset `cycleIndex` to 1 |

Rules:

- On every state transition, clear `pomodoro_transition` and re-create it if the new state is not `idle`.
- `daily_reset` is (re-)created on startup and after each midnight fires.
- On `alarms.onAlarm`, match by name and call the same handler as a natural completion.

## Tick stream

A per-second `Tick` payload is pushed only while at least one UI port is connected.

```ts
type Tick = {
  state: EngineState['state'];
  remainingMs: number;
  task?: { id: string; title: string; projectId: string; projectName: string; projectColor: string };
  cycleIndex: number;
  distractionCountSession: number;
};
```

Port lifecycle:

```ts
// UI connects with:
const port = browser.runtime.connect({ name: 'tick' });

// Background:
const connectedPorts = new Set<browser.runtime.Port>();

browser.runtime.onConnect.addListener((port) => {
  if (port.name !== 'tick') return;
  connectedPorts.add(port);
  if (connectedPorts.size === 1) startTickInterval();
  port.onDisconnect.addListener(() => {
    connectedPorts.delete(port);
    if (connectedPorts.size === 0) stopTickInterval();
  });
  broadcastTick(); // send immediately on connect
});
```

`setInterval(broadcastTick, 1000)` runs only while `connectedPorts.size > 0`. State-change events are broadcast via `runtime.sendMessage` regardless of connected ports.

## cycleIndex

- Starts at 1 on a fresh install and after each midnight reset.
- Increments by 1 when a work pomodoro completes (before deciding break type).
- After incrementing: if `cycleIndex > longBreakEvery`, reset to 1 immediately (handles the wrap).
- The break type for the just-completed work interval is `long_break` if `cycleIndex === longBreakEvery` (checked before incrementing).
- Cancelled work pomodoros do NOT change `cycleIndex`.
- `daily_reset` alarm sets `cycleIndex = 1` at local midnight.

```ts
function nextBreakKind(
  cycleIndex: number,
  longBreakEvery: number
): 'short_break' | 'long_break' {
  return cycleIndex === longBreakEvery ? 'long_break' : 'short_break';
}
```

## Work completion flow

1. Derive `distractionCount` by querying `db.listDistractionsForPomodoro(pomodoroId)` then taking `.length`.
2. Call `db.finishPomodoro(id, Date.now(), true)` - sets `endedAt`, `completedFully: true`, `distractionCount`.
3. Call `db.incrementCompletedPomodoros(taskId)`.
4. Determine break kind via `nextBreakKind(cycleIndex, settings.longBreakEvery)`.
5. Increment `cycleIndex` (wrap if needed).
6. Emit `pomodoro.completed`.
7. If `settings.autoStartBreaks`: transition to break state, create new Pomodoro DB row for the break, set alarm. Otherwise transition to `idle`.
8. Persist `EngineState`.

## Cancel flow

1. Call `db.finishPomodoro(id, Date.now(), false)`.
2. Emit `pomodoro.cancelled`.
3. Transition to `idle`. `cycleIndex` is unchanged.
4. Clear `pomodoro_transition` alarm.
5. Persist `EngineState`.

Cancel is valid in all non-idle states (work and both break kinds).

## Crash recovery

Called once after `hydrateEngineState()` returns a non-idle state:

```ts
async function recoverCrashedSession(state: EngineState): Promise<void> {
  if (state.state === 'idle') return;
  const elapsed = Date.now() - (state.startedAt ?? 0);
  if (elapsed >= state.plannedDurationMs) {
    // completed while background was down - treat as natural completion
    await handleCompletion(state, /* at */ state.startedAt! + state.plannedDurationMs);
  } else {
    // still within planned duration - restore and reschedule alarm
    rescheduleTransitionAlarm(state);
  }
}
```

"Best-effort" means: if the task or pomodoro row is missing (e.g. after reinstall + import), log a warning and reset to idle rather than throwing.

## Distraction count denormalization

The engine tracks `distractionCountSession` in memory (reset to 0 on each `idle -> work` transition). It increments by 1 each time a `distraction.added` internal event fires with a matching `pomodoroId`. The final count is written to `Pomodoro.distractionCount` via `db.finishPomodoro` at completion or cancel.

## Messages handled

```ts
type PomodoroRequest =
  | { kind: 'pomodoro.start'; taskId: string }
  | { kind: 'pomodoro.cancel' }
  | { kind: 'pomodoro.snapshot' }
  | { kind: 'pomodoro.skipBreak' };

type PomodoroResponse =
  | { kind: 'pomodoro.start'; ok: true; state: EngineState['state']; startedAt: number; plannedDurationMs: number }
  | { kind: 'pomodoro.start'; ok: false; error: 'busy' | 'task_not_found' }
  | { kind: 'pomodoro.cancel'; ok: true }
  | { kind: 'pomodoro.snapshot'; tick: Tick }
  | { kind: 'pomodoro.skipBreak'; ok: true }
  | { kind: 'pomodoro.skipBreak'; ok: false; error: 'not_in_break' };
```

`pomodoro.skipBreak` is only valid when `state` is `short_break` or `long_break`. It ends the break immediately and applies the same completion logic as a natural break end (respects `autoStartNextWork`).

## Events broadcast

Sent via `runtime.sendMessage` to all listeners AND pushed to all connected tick ports:

```ts
type PomodoroEvent =
  | { kind: 'pomodoro.started'; state: EngineState['state']; startedAt: number; plannedDurationMs: number; task: Task }
  | { kind: 'pomodoro.tick'; state: EngineState['state']; remainingMs: number; distractionCountSession: number }
  | { kind: 'pomodoro.state_change'; from: EngineState['state']; to: EngineState['state']; at: number }
  | { kind: 'pomodoro.completed'; pomodoro: Pomodoro; task: Task }
  | { kind: 'pomodoro.cancelled'; pomodoro: Pomodoro };
```

`pomodoro.state_change` fires on every transition, including idle -> work and work -> break.

## Task auto-transition on start

When `pomodoro.start` is received and the target task has `status === 'todo'`, the engine calls `TasksService.setStatus(taskId, 'doing')` before creating the Pomodoro row. This mirrors the rule defined in spec 02.

## Acceptance

- Calling `pomodoro.start` twice without completing or cancelling returns `{ok: false, error: 'busy'}` on the second call.
- Cancelling a work pomodoro writes `completedFully: false` to the DB and does NOT call `incrementCompletedPomodoros`.
- Completing 4 consecutive work pomodoros with `longBreakEvery = 4` triggers a `long_break` on the 4th completion and a `short_break` on the 1st, 2nd, and 3rd.
- After Firefox is restarted mid-pomodoro and the background re-initializes, `pomodoro.snapshot` returns a `remainingMs` within 2 seconds of the expected value (accounting for restart time).
- A `daily_reset` alarm firing at local midnight resets `cycleIndex` to 1; pomodoros that started before midnight keep their original `cycleIndex` stored in their DB row.
- `setInterval` for tick is created on first port connect and cleared on last port disconnect. No interval runs when no UI is open.
- Vitest covers: all state machine transitions, `nextBreakKind` for boundary values (1, `longBreakEvery - 1`, `longBreakEvery`), and the crash recovery branch for both the "elapsed >= planned" and "still within planned" cases.

## Out of scope

- Pause and resume (defer to post-MVP).
- Multiple parallel pomodoros.
- Custom transition rules or conditional breaks.
- Sound effects or OS-level notifications.
- Per-task or per-project timer durations (all durations come from global Settings).

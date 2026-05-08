---
title: UI - Popup
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# UI - Popup

The compact toolbar popup (340x480 px, dark theme) is the primary interaction surface for FocusFox. It allows the user to pick a task, set an estimate, start a Pomodoro, track distractions, and cancel the current session. State is mirrored live from the background engine via a long-lived port; the popup never queries IndexedDB directly.

## Depends on

- `03-pomodoro-engine` - snapshot, per-second ticks, `pomodoro.start`, `pomodoro.cancel`, `pomodoro.skipBreak`.
- `02-projects-and-tasks` - `projects.list`, `tasks.list`, `tasks.setEstimate`.
- `05-distraction-tracking` - `distraction.manual`, distraction count on `Tick`.

## Used by

Nothing. This is a leaf surface opened by the browser toolbar action.

---

## Mounting

Entry point: `popup/index.html` loads `popup/main.tsx`, which renders `<App />` into `#root`.

```ts
// popup/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './popup.css';

createRoot(document.getElementById('root')!).render(<App />);
```

Styles are a single `popup.css` file. No Tailwind, no CSS-in-JS. Class names are BEM-style. This keeps the bundle minimal and avoids Tailwind's purge config complexity for an extension popup.

---

## Layout

Fixed container: `width: 340px; height: 480px`. No scrollbars on default content. All child sections are sized to fit within this box. If the browser allows `height: auto`, the popup may grow up to 600px to accommodate inline inputs, but the default layout must fit in 480px.

---

## Phase model

```
loading -> idle
loading -> error
idle    -> active  (pomodoro.start succeeds)
active  -> idle    (pomodoro.cancel confirmed)
active  -> break   (work phase ends)
break   -> active  (next work phase begins, or skipBreak)
break   -> idle    (full cycle done, autoStartNextWork false)
any     -> error   (port disconnects unexpectedly)
```

The popup tracks these as the `phase` field in the Zustand store (see below).

---

## Zustand store

```ts
// popup/store.ts
import type { Project, Task, Tick } from '../shared/types';

type Phase = 'loading' | 'idle' | 'active' | 'break' | 'error';

interface PopupState {
  phase: Phase;
  tick: Tick | null;
  projects: Project[];
  tasks: Task[];               // active (status !== 'done') tasks for selected project
  selectedTaskId: string | null;
  estimateDraft: number;       // 1..20, mirrors task.estimatedPomodoros or defaults to 1
  showManualInput: boolean;
  showCancelConfirm: boolean;
  error: string | null;
}

interface PopupActions {
  setPhase(phase: Phase): void;
  applyTick(tick: Tick): void;
  setProjects(projects: Project[]): void;
  setTasks(tasks: Task[]): void;
  selectTask(id: string | null): void;
  setEstimateDraft(n: number): void;
  setShowManualInput(v: boolean): void;
  setShowCancelConfirm(v: boolean): void;
  setError(msg: string | null): void;
}
```

The store is created with `create<PopupState & PopupActions>()(...)`. No persistence - the store is ephemeral per popup open.

---

## Background communication

### Port (tick stream)

On `<App />` mount, open a long-lived port:

```ts
const port = browser.runtime.connect({ name: 'tick' });
port.onMessage.addListener((msg: TickMessage | StateChangeMessage | DistractionMessage) => {
  if (msg.kind === 'pomodoro.tick') store.applyTick(msg.tick);
  if (msg.kind === 'pomodoro.state_change') handleStateChange(msg);
  if (msg.kind === 'distraction.added') /* tick carries updated count, no extra action needed */;
  if (msg.kind === 'data-changed') refreshData();
});
port.onDisconnect.addListener(() => store.setError('No se pudo mantener conexion con el background.'));
```

Disconnect the port in the cleanup of the top-level effect (unmount).

### Initial snapshot

After opening the port, send a one-shot message to hydrate state:

```ts
const snapshot: Tick = await browser.runtime.sendMessage({ kind: 'pomodoro.snapshot' });
store.applyTick(snapshot);
store.setPhase(snapshot.state === 'idle' ? 'idle' : 'active');
```

### Data load

On mount and on `data-changed` events, fetch projects and tasks:

```ts
async function refreshData() {
  const projects = await browser.runtime.sendMessage({ kind: 'projects.list' });
  store.setProjects(projects);
  if (store.selectedTaskId) {
    const task = projects.flatMap(p => []).find(t => t.id === store.selectedTaskId);
    if (task) {
      const tasks = await browser.runtime.sendMessage({ kind: 'tasks.list', projectId: task.projectId });
      store.setTasks(tasks.filter(t => t.status !== 'done'));
    }
  }
}
```

When `selectedTaskId` changes, fetch tasks for the owning project.

---

## Components

### `<App />`

Root component. Reads `phase` from store and renders the correct view. Owns the port lifecycle effect.

```ts
interface AppProps {} // no props - reads from store
```

Renders:
- `phase === 'loading'` -> `<LoadingView />`
- `phase === 'idle'` -> `<IdleView />`
- `phase === 'active'` -> `<ActiveView />`
- `phase === 'break'` -> `<BreakView />`
- `phase === 'error'` -> `<ErrorView />`

All views share `<Header />` at the top.

---

### `<Header />`

Top row. Brand mark (fox SVG icon + "FocusFox" wordmark), a status chip, and a dashboard icon-link.

```ts
interface HeaderProps {
  mode: Phase;
  dashboardHref: string; // chrome-extension://...dashboard/index.html
}
```

Clicking the dashboard icon calls `browser.tabs.create({ url: dashboardHref })` and closes the popup.

---

### `<TaskSelector />`

Shown in `<IdleView />`. A `<select>` element with `<optgroup>` per project. Only non-archived projects with at least one active task appear.

```ts
interface TaskSelectorProps {
  projects: Project[];
  tasks: Task[];                // flat list of active tasks for the selected project
  selectedTaskId: string | null;
  onSelectTask(id: string): void;
  onSelectProject(id: string): void;
}
```

Empty states:
- No non-archived projects: shows a `<p>` with a link "Crea un proyecto desde el dashboard".
- Selected project has no active tasks: shows a `<p>` with a link "+ nueva tarea" that opens the dashboard tasks route.

The `<select>` renders all non-archived projects as `<optgroup label={project.name}>` with each active task as `<option value={task.id}>{task.title}</option>`.

---

### `<EstimateStepper />`

Shown in `<IdleView />` below the task selector. A `-` button, a numeric display, and a `+` button.

```ts
interface EstimateStepperProps {
  value: number;
  onChange(n: number): void;
  min: number; // 1
  max: number; // 20
}
```

Pressing `-` at `min` or `+` at `max` is a no-op (buttons disabled via `aria-disabled`). On blur or when "Iniciar" is pressed, the estimate is sent: `browser.runtime.sendMessage({ kind: 'tasks.setEstimate', id: selectedTaskId, estimatedPomodoros: estimateDraft })`. This is fire-and-forget from the popup's perspective and does not block starting the Pomodoro.

---

### `<Ring />`

Shown in `<ActiveView />` and `<BreakView />`. SVG circle with a gradient stroke arc indicating remaining time. Centered MM:SS text uses JetBrains Mono with tabular numerals.

```ts
interface RingProps {
  sizePx: number;         // 196
  remainingMs: number;
  totalMs: number;
  label: string;          // 'trabajando' | 'descanso corto' | 'descanso largo'
  active: boolean;        // true = show pulse dot at arc tip
}
```

Implementation notes (not prescriptive but must meet visual spec):
- SVG `circle` with `stroke-dasharray` / `stroke-dashoffset` to draw progress arc.
- Gradient defined via `<linearGradient>` with stop1 `#f5b765` and stop2 `#d18a32`.
- Drop shadow via SVG `<filter>` with `feDropShadow` in amber.
- Stroke width: 5px. Circle centered at `(sizePx/2, sizePx/2)`.
- Time format: `MM:SS` for times under 60 minutes; `H:MM:SS` for 60 minutes or more. Always zero-padded.
- The `<text>` element has `font-family: 'JetBrains Mono', monospace` and `font-feature-settings: "tnum"`.
- The container element has `aria-live="polite"` and `aria-label` updated to the formatted time. To avoid screen reader flooding, only update `aria-label` when the minute changes (not every second).
- Pulse dot: a small filled circle at the arc tip, animated with a CSS `@keyframes` opacity pulse.

---

### `<TaskCard />`

Shown in `<ActiveView />`. Displays the current task title and a project color tag.

```ts
interface TaskCardProps {
  taskTitle: string;
  projectName: string;
  projectColor: ProjectColor;
}
```

Data sourced from `tick.task`. If `tick.task` is null for some reason, the card renders a placeholder "Sin tarea".

---

### `<DistractionRow />`

Shown in `<ActiveView />`. Displays the session distraction count and a "Me distraje" button.

```ts
interface DistractionRowProps {
  count: number;           // tick.distractionCountSession
  onManualClick(): void;   // reveals ManualDistractionInput
}
```

Counter reads from `tick.distractionCountSession`. The button is always enabled; the background handles deduplication.

---

### `<ManualDistractionInput />`

Inline form that appears below `<DistractionRow />` when `showManualInput === true`. An optional text field (reason) with Submit and Cancel actions.

```ts
interface ManualDistractionInputProps {
  onSubmit(reason: string | undefined): void;
  onCancel(): void;
}
```

- Pressing Enter submits.
- Pressing Escape cancels.
- Submitting calls `browser.runtime.sendMessage({ kind: 'distraction.manual', reason: reason || undefined })`.
- On success response, `setShowManualInput(false)`.
- The text field is focused automatically when the component mounts (`autoFocus`).

---

### `<Actions />`

Two-button row rendered in `<IdleView />` and `<ActiveView />`.

```ts
type ActionsKind = 'idle' | 'active';

interface ActionsProps {
  kind: ActionsKind;
  onPrimary(): void;   // 'idle': Iniciar | 'active': (unused, primary is Ring area)
  onSecondary(): void; // 'idle': disabled/null | 'active': Cancelar
  primaryDisabled?: boolean;
}
```

Idle view: single primary button "Iniciar pomodoro". Disabled if `selectedTaskId` is null.
Active view: secondary button "Cancelar" which sets `showCancelConfirm(true)`.

---

### `<CancelConfirm />`

Inline confirmation shown when `showCancelConfirm === true`. Replaces the distraction row area.

```ts
interface CancelConfirmProps {
  onConfirm(): void;
  onDismiss(): void;
}
```

Text: "Cancelar pomodoro? Se registrara como no completado."
Two buttons: "Si, cancelar" (calls `pomodoro.cancel` then transitions to idle) and "No, continuar".

---

## Idle interactions

1. On mount: load projects; auto-select first project and first task if available.
2. User selects a task from `<TaskSelector />` - updates `selectedTaskId`, fetches tasks for that project.
3. User adjusts estimate via `<EstimateStepper />` - updates `estimateDraft`.
4. User clicks "Iniciar pomodoro":
   - Fire `tasks.setEstimate` (non-blocking).
   - Send `{ kind: 'pomodoro.start', taskId: selectedTaskId }`.
   - On `{ ok: true }`: transition to `active` phase. The next `pomodoro.tick` from the port will carry the full state.
   - On error: show a transient toast (a simple absolutely-positioned `<div>` that auto-hides after 3s).

---

## Active interactions

1. Tick messages from port update `tick` in store every second.
2. `<Ring />` re-renders on each tick; the SVG arc and time text update without unmounting.
3. "Me distraje": sets `showManualInput(true)`. `<ManualDistractionInput />` appears.
4. Submit distraction: sends `{ kind: 'distraction.manual', reason? }`. On success, hide input.
5. "Cancelar": sets `showCancelConfirm(true)`. `<CancelConfirm />` appears.
6. Confirm cancel: sends `{ kind: 'pomodoro.cancel' }`. On `{ ok: true }`, transition to idle, clear tick.
7. `pomodoro.state_change` from port with `state: 'short_break'` or `state: 'long_break'`: transition to `break` phase.

---

## Break phase

`<BreakView />` shows `<Ring />` (label "descanso corto" or "descanso largo") and a single button "Saltar descanso" that sends `{ kind: 'pomodoro.skipBreak' }`. On `{ ok: true }` or on next `state_change`, transition back to active or idle as appropriate.

---

## Error phase

`<ErrorView />` shows the error message string and a "Reintentar" button. Retry re-runs the mount initialization logic (open port, fetch snapshot, load data) and resets `error` to null.

---

## Visual spec

| Token | Value |
|---|---|
| Background | `#0d0f12` |
| Radial gradient (top) | `radial-gradient(ellipse at 50% -20%, rgba(232,164,79,0.12) 0%, transparent 70%)` |
| Accent | `#e8a44f` |
| Text primary | `#f0ede8` |
| Text secondary | `#8a8480` |
| Ring stroke stop1 | `#f5b765` |
| Ring stroke stop2 | `#d18a32` |
| Ring size | 196px |
| Ring stroke width | 5px |
| Body font | Inter, system-ui, sans-serif |
| Monospace font | JetBrains Mono, monospace |
| Border radius (cards) | 8px |
| Border radius (buttons) | 6px |

Focus rings: `outline: 2px solid #e8a44f; outline-offset: 2px` on all interactive elements. Never `outline: none` without a visible replacement.

---

## Accessibility

- All `<button>` elements have an `aria-label` when the label text is not descriptive in isolation (e.g., "-", "+").
- `<Ring />` container: `role="timer"`, `aria-live="polite"`, `aria-label` updated at most once per minute.
- `<TaskSelector />` `<select>` has an associated `<label>`.
- Tab order follows visual top-to-bottom left-to-right layout. No `tabIndex > 0`.
- Color is not the sole signal for any state (text labels always accompany color cues).

---

## Tests

Vitest + `@testing-library/react`. Mock `browser.runtime` via `vitest.mock` or a manual mock in `tests/__mocks__/browser.ts`.

Required test scenarios:
- Idle render: snapshot matches, task selector populated, Iniciar button disabled with no task selected.
- Task selection: selecting a task enables Iniciar, estimate stepper reflects task's `estimatedPomodoros`.
- Idle to active flow: clicking Iniciar sends correct message; mock resolves; store transitions to `active`; `<Ring />` renders.
- Manual distraction: clicking "Me distraje", submitting empty reason, verifying `distraction.manual` message sent with `reason: undefined`.
- Cancel flow: clicking Cancelar shows confirmation; clicking "No, continuar" hides it; clicking "Si, cancelar" sends `pomodoro.cancel` and transitions to idle.
- Break phase render: given a `Tick` with `state: 'short_break'`, popup shows `<BreakView />` with correct label.
- Reopen during active: initializing store with a tick in `work` state immediately renders active view (no loading flicker).

---

## Acceptance

- Opening the popup while idle shows the task selector populated with active tasks grouped by project, with the first task auto-selected.
- Clicking "Iniciar pomodoro" with a selected task transitions the popup to the active view within 200ms (measured from click to ring render).
- The ring arc and time text update every second without flicker or layout shift.
- Clicking "Me distraje" with no reason text and pressing Enter persists a manual distraction; the session counter in `<DistractionRow />` increments on the next tick.
- Clicking "Cancelar" shows the inline confirmation. Clicking "No, continuar" dismisses it without cancelling. Clicking "Si, cancelar" cancels and returns to idle.
- Closing and reopening the popup while a Pomodoro is active immediately shows the correct remaining time via the snapshot; no perceptible loading state shown to the user.
- All interactive elements reachable via Tab in logical order; focus rings visible on all focused elements.
- Vitest suite covers the idle-to-active flow and cancel flow with a mocked port.

---

## Out of scope

- Settings UI (dashboard only).
- Creating or editing projects or tasks from the popup.
- Viewing historical stats.
- Multi-window popup support (Firefox opens one popup instance at a time; no coordination needed).
- Keyboard shortcuts at the browser level (listed as MVP non-goal in spec 00).
- Notification banners outside the popup window.

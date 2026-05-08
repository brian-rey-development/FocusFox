---
title: UI - Dashboard
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# UI - Dashboard

The full-tab application shell that hosts all primary views: Today (Hoy), Tasks (Tareas), Stats, and Settings. It opens at `moz-extension://<id>/dashboard/index.html`, renders a persistent 240px sidebar alongside a flexible main area, and stays live-synced with the background script via `browser.runtime.onMessage`. All data mutations are sent as typed messages to the background; the UI never touches IndexedDB directly.

## Depends on

- `02-projects-and-tasks` - project and task CRUD messages and `DataChangedEvent` broadcasts.
- `03-pomodoro-engine` - `pomodoro.snapshot`, `pomodoro.tick`, `pomodoro.state_change` for the live MiniTimer.
- `06-daily-timeline` - `notes.listDay` and `notes.changed` for TodayView.
- `07-stats` - `stats.range` response shape for StatsView.
- `11-ui-settings` - `SettingsView` component and `settings.get` / `settings.update` messages.

## Used by

Nothing. This is a leaf surface.

---

## Mount

`dashboard/index.html` loads `dashboard/main.tsx` as its entry point.

```ts
// dashboard/main.tsx
import React from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root');
createRoot(root).render(<App />);
```

`<App />` wraps the entire tree in the Zustand store provider (no explicit React context needed - Zustand is module-level) and renders `<Shell />`.

---

## Routing

A tiny custom hook keeps the dependency footprint minimal. No `react-router` or `wouter` for MVP.

```ts
// dashboard/hooks/useHashRoute.ts
export type Tab = 'hoy' | 'tareas' | 'stats' | 'settings';

export interface Route {
  tab: Tab;
  params: Record<string, string>;
}

// Parses `#tareas/proj-id` -> { tab: 'tareas', params: { projectId: 'proj-id' } }
export function parseHash(hash: string): Route;

// Returns current route and a navigate function.
export function useHashRoute(): [Route, (tab: Tab, params?: Record<string, string>) => void];
```

Rules:
- Default hash (empty or `#`) resolves to `hoy`.
- `#tareas` with no segment sets `params.projectId` to `undefined`.
- `#tareas/abc123` sets `params.projectId = 'abc123'`.
- Navigating calls `window.location.hash = ...` and the hook's `hashchange` listener updates state.
- The store mirrors the current route in `DashState.route` so components can read it from Zustand without subscribing to the hook directly.

---

## Zustand store

```ts
// dashboard/store.ts

import type { Project, Task, NoteEntry, Settings, Tick } from '../shared/types';

export interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'info';
}

export interface StatsSummary {
  totalPomodoros: number;
  totalFocusMs: number;
  distractionCount: number;
  byProject: Array<{ projectId: string; projectName: string; color: string; count: number }>;
  heatmap: Array<{ day: string; count: number }>;
}

export interface DashState {
  route: { tab: 'hoy' | 'tareas' | 'stats' | 'settings'; params: Record<string, string> };
  tick: Tick | null;
  projects: Project[];
  selectedProjectId: string | null;
  tasksByProject: Record<string, Task[]>;
  notesByDay: Record<string, NoteEntry[]>;
  statsCache: Partial<StatsSummary>;
  settings: Settings | null;
  toasts: Toast[];
}

export interface DashActions {
  setRoute(route: DashState['route']): void;
  setTick(tick: Tick | null): void;
  setProjects(projects: Project[]): void;
  setSelectedProject(id: string | null): void;
  setTasksForProject(projectId: string, tasks: Task[]): void;
  setNotesForDay(day: string, notes: NoteEntry[]): void;
  setStatsCache(summary: Partial<StatsSummary>): void;
  setSettings(settings: Settings): void;
  pushToast(toast: Omit<Toast, 'id'>): void;
  removeToast(id: string): void;
}

export type DashStore = DashState & DashActions;
```

The store is created once with `create<DashStore>(...)`. All actions are pure setters; no async logic inside the store.

---

## Shell layout

```ts
// dashboard/components/Shell.tsx

interface ShellProps {
  sidebar: React.ReactNode;
  main: React.ReactNode;
}
```

Structure (CSS grid or flexbox):

```
+------------------------------------------+
| [Sidebar 240px fixed] | [Main flex-1]    |
|                       |                  |
|                       |                  |
+------------------------------------------+
```

- `min-width: 1024px` on the root; viewport narrower than 800px collapses the sidebar and shows a hamburger icon in the topbar.
- Sidebar collapse is optional polish for MVP. Spec documents the breakpoint but the CSS implementation may be left as a TODO.
- Background colors: sidebar `#131619`, main `#1a1d22`.
- Border between sidebar and main: `1px solid rgba(255,255,255,0.06)`.

---

## Sidebar

### Component tree

```
<Sidebar>
  <BrandHeader />
  <NavSection title="Vistas">
    <NavItem /> x3  (Hoy, Tareas, Stats)
  </NavSection>
  <NavSection title="Proyectos">
    <ProjectList>
      <ProjectItem /> x n
      <ProjectAdd />
    </ProjectList>
  </NavSection>
  <MiniTimer />          <!-- visible only when tick.state === 'work' -->
</Sidebar>
```

### Component interfaces

```ts
interface BrandHeaderProps {
  // static, no props
}

interface NavSectionProps {
  title: string;
  children: React.ReactNode;
}

interface NavItemProps {
  icon: React.ReactNode;      // Lucide-style stroke SVG
  label: string;
  shortcut?: string;          // e.g. "1"
  active: boolean;
  onClick: () => void;
}

interface ProjectItemProps {
  id: string;
  name: string;
  color: ProjectColor;        // drives the dot color
  taskCount: number;          // active (non-done) tasks
  active: boolean;
  onClick: () => void;
}

interface ProjectAddProps {
  onClick: () => void;        // opens ProjectCreateModal
}

interface MiniTimerProps {
  tick: Tick;                 // caller guards tick.state === 'work'
  onClick: () => void;        // navigate to #hoy
}
```

`NavItem` sets `aria-current="page"` when `active` is true.

`ProjectItem` renders a filled circle with the project color from the palette (spec 01: blue, amber, green, purple, red, cyan). Color hex values are defined in `shared/constants.ts`.

`MiniTimer` shows the remaining time formatted as `mm:ss`, the task title truncated to one line, and an amber pulsing ring. The pulse animation respects `prefers-reduced-motion`: when the media query matches, the ring is static.

---

## Topbar

```ts
// dashboard/components/Topbar.tsx

interface TopbarProps {
  route: Route;
  navigate: (tab: Tab, params?: Record<string, string>) => void;
  rightAction?: React.ReactNode;   // e.g. RangeSelector on Stats tab
}
```

The segmented control renders three tabs (Hoy, Tareas, Stats). Settings is accessible via a gear icon on the right end of the topbar, not in the segmented control. Active tab has a highlighted background.

```ts
interface TabsSegmentedProps {
  tabs: Array<{ id: Tab; label: string }>;
  active: Tab;
  onChange: (tab: Tab) => void;
}
```

---

## Keyboard shortcuts

Registered in `<App />` via a single `keydown` listener on `window`.

| Key | Action |
|---|---|
| `1` | Navigate to `#hoy` |
| `2` | Navigate to `#tareas` (preserves last selected project) |
| `3` | Navigate to `#stats` |
| `n` | Focus the primary new-input for the active tab (new note in Hoy; new task input in Tareas) |
| `?` | Toggle the `<ShortcutsCheatsheet />` overlay |

`n` uses a `ref` forwarded from the active view. Each view exposes a `focusPrimaryInput()` method via `useImperativeHandle`.

Shortcuts are suppressed when focus is inside an `<input>`, `<textarea>`, or `[contenteditable]`.

---

## TodayView

```ts
// dashboard/routes/Today.tsx

interface TodayViewProps {
  day: string;          // YYYY-MM-DD, today
  notes: NoteEntry[];
  onAddNote: (text: string) => void;
}

interface QuickNoteInputProps {
  onSubmit: (text: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

interface TimelineListProps {
  entries: NoteEntry[];
}

interface TimelineItemProps {
  entry: NoteEntry;
}
```

`TimelineItem` renders a tag pill to the left of the entry text. `auto` entries use a muted/gray pill; `user` entries use a blue pill. Both show a formatted time (e.g. `14:32`).

Empty state when `notes.length === 0`:

> "Aun no hay registros de hoy."
> [CTA button: "Empezar pomodoro" - opens the extension popup via `browser.action.openPopup()` if available, otherwise shows a tooltip instructing the user to click the toolbar icon]

---

## TasksView

```ts
// dashboard/routes/Tasks.tsx

interface TasksViewProps {
  project: Project | null;
  tasks: Task[];
  activeTick: Tick | null;
  onCreateTask: (title: string) => void;
  onToggleDone: (taskId: string) => void;
  onDeleteTask: (taskId: string) => void;
  onRenameTask: (taskId: string, title: string) => void;
}

interface ProjectHeaderProps {
  project: Project;
  totalTasks: number;
  doneTasks: number;
}

interface NewTaskInputProps {
  onSubmit: (title: string) => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

interface TaskRowProps {
  task: Task;
  isActive: boolean;         // task.id === tick?.task?.id
  onToggleDone: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

interface TaskCheckProps {
  done: boolean;
  onChange: () => void;
}

interface ProjectColorDotProps {
  color: ProjectColor;
  size?: number;             // px, default 10
}

interface PomoDotsProps {
  completed: number;
  estimated: number | null;
}

interface TaskMenuProps {
  onRename: () => void;
  onDelete: () => void;
}
```

Task list order: `createdAt` ascending (matches spec 02). Done tasks appear below active ones, lightly muted.

`PomoDots` renders filled amber circles for completed pomodoros, outlined circles for estimated-but-not-yet-done slots. If `estimated` is null, shows only the count as text.

`TaskRow` shows an `isActive` amber pill labeled "En curso" when `isActive` is true.

Empty states:

- No project selected: "Selecciona un proyecto en la barra lateral o crea uno nuevo."
- Project selected but no tasks: "Aun no hay tareas en este proyecto. Crea una arriba."

---

## StatsView

Delegates rendering to the components defined in spec 07. This spec defines only the integration contract.

```ts
// dashboard/routes/Stats.tsx

interface StatsViewProps {
  summary: Partial<StatsSummary>;
  rangedays: 7 | 30 | 90 | 365;
  onRangeChange: (days: 7 | 30 | 90 | 365) => void;
}

interface RangeSelectorProps {
  value: 7 | 30 | 90 | 365;
  onChange: (days: 7 | 30 | 90 | 365) => void;
}
```

`RangeSelector` is passed as `rightAction` to `<Topbar />` when the Stats tab is active.

Stats fetch is debounced 200ms on range change to avoid rapid background calls while the user clicks through options.

Empty state when `summary.totalPomodoros === 0` or summary not yet loaded:

> "Cuando completes tu primer pomodoro, vas a verlo aqui."

---

## SettingsView

Fully specified in spec 11. The dashboard renders it as a route component:

```ts
// dashboard/routes/Settings.tsx
// Re-exports or wraps <SettingsView> from spec 11 implementation.
```

---

## Project creation modal

```ts
// dashboard/components/ProjectCreateModal.tsx

interface ProjectCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}
```

- Centered overlay, max-width 480px, `backdrop-filter: blur(4px)`, background `#1a1d22`, border `1px solid rgba(255,255,255,0.10)`.
- Fields: project name (text input, required, max 80 chars) and color picker.
- Color picker: 6 swatches in a row, one per `ProjectColor` value. Selected swatch has a 2px amber ring.
- Hex values for swatches are in `shared/constants.ts`, matching spec 01's palette.
- Submit calls `browser.runtime.sendMessage({ kind: 'projects.create', name, color })`.
- On success: calls `onCreated(project)`, closes modal, dispatches a `projects.changed` handling path so the sidebar updates without a full re-fetch.
- On error: shows inline validation message below the name input.
- `Escape` key closes the modal.
- Focus trap: Tab cycles between name input, swatches, cancel button, create button.

---

## Live updates

`<App />` registers one `browser.runtime.onMessage` listener on mount and removes it on unmount.

```ts
type IncomingEvent =
  | { kind: 'projects.changed' }
  | { kind: 'tasks.changed'; projectId: string }
  | { kind: 'notes.changed'; day: string }
  | { kind: 'pomodoro.tick'; tick: Tick }
  | { kind: 'pomodoro.state_change'; tick: Tick }
  | { kind: 'stats.invalidated' };
```

Re-fetch strategy (only the affected slice):

| Event | Action |
|---|---|
| `projects.changed` | Re-fetch all projects; update `store.projects`. |
| `tasks.changed { projectId }` | If `selectedProjectId === projectId`, re-fetch tasks for that project. |
| `notes.changed { day }` | If today's day key matches `day`, re-fetch notes for today. |
| `pomodoro.tick` / `pomodoro.state_change` | Update `store.tick` directly (no background roundtrip). |
| `stats.invalidated` | If Stats tab is active, re-fetch stats with current range. |

On initial mount, `<App />` sends `pomodoro.snapshot` and `projects.list` in parallel to hydrate the store before rendering.

---

## Shared components

```ts
interface TooltipProps {
  content: string;
  children: React.ReactElement;
  placement?: 'top' | 'bottom' | 'left' | 'right';
}

interface DropdownProps {
  trigger: React.ReactElement;
  items: Array<{ label: string; onClick: () => void; destructive?: boolean }>;
}

interface ConfirmModalProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}

interface ToastProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}
```

`Toast` renders in a fixed bottom-right stack. Auto-dismisses after 4 seconds. Max 3 toasts visible at once; overflow drops oldest.

---

## Visual rules

- Font family: Inter for UI text, JetBrains Mono for timer display and numeric stat values.
- Accent color: `#e8a44f` (amber).
- Sidebar background: `#131619`. Main area background: `#1a1d22`.
- Active nav item and active tab: background `rgba(232, 164, 79, 0.12)`, left or bottom border `2px solid #e8a44f`.
- Borders: `rgba(255,255,255,0.06)` for structural dividers; `rgba(255,255,255,0.10)` for card and modal outlines.
- Stat cards: 1px top edge highlight using `linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)`.
- Heatmap cells: 12px square, 3px gap, five levels mapped from transparent (0 pomodoros) to full amber (spec 07's level 4 mapping).
- MiniTimer pulse: `@keyframes pulse` expanding ring in amber. Suppressed via `@media (prefers-reduced-motion: reduce)`.

---

## Accessibility

- Skip link: first focusable element in the document, visually hidden until focused. Target is `#main-content` on the main area.
- Tab order: skip link -> sidebar nav -> sidebar project list -> topbar -> main content.
- `aria-current="page"` on the active `<NavItem>`.
- `<NavSection>` uses `<nav aria-label="...">` with the section title as the label.
- All icon-only buttons have `aria-label`.
- Modal uses `role="dialog"`, `aria-modal="true"`, and `aria-labelledby` pointing to the modal title.
- Color swatches in the project create modal use `aria-label` with the color name and `aria-pressed` for selected state.

---

## Performance

- No list virtualization for MVP. Lists are expected to be short (< 100 tasks per project, < 200 timeline entries per day).
- Stats fetch debounced 200ms on range change.
- `notes.listDay` and `tasks.list` calls are issued only when the corresponding tab is visible or a relevant `data-changed` event fires for the currently-shown data.
- `pomodoro.tick` events update the store directly without a background roundtrip to minimize flicker on the 1-second counter.

---

## Acceptance

- Opening the dashboard with no data shows the Hoy tab with the "Aun no hay registros de hoy." empty state.
- Creating a project via the modal adds it to the sidebar project list immediately without a page reload.
- Creating a task on the Tareas tab inserts it at the top of the list before existing tasks, reflecting `createdAt` ascending order.
- Pressing `1`, `2`, `3` navigates to Hoy, Tareas, Stats respectively and updates `window.location.hash`.
- The MiniTimer component appears in the sidebar when a `pomodoro.tick` event arrives with `state === 'work'` and disappears on `state === 'idle'`.
- Opening the dashboard in two tabs, creating a task in tab A, causes tab B to display the new task within approximately 500ms via the `tasks.changed` broadcast.
- With `prefers-reduced-motion: reduce` active, the amber pulse animation on MiniTimer is not applied.
- Pressing `?` opens the shortcuts cheatsheet overlay.
- Pressing `n` while on the Tareas tab moves focus to the NewTaskInput field.
- Tab deletion confirmation modal traps focus and can be dismissed with `Escape`.
- Vitest + `@testing-library/react` cover: hash routing parse and navigation, project creation flow (modal open -> submit -> sidebar update), task creation and toggle-done, MiniTimer visibility driven by tick state, and live sync via simulated `onMessage` events.

---

## Out of scope

- Drag-and-drop task reorder.
- Theme switching (dark-only for MVP).
- Multi-language / i18n.
- Sub-task hierarchy.
- Virtualized lists.
- Responsive sidebar collapse (documented above as optional polish; not required for MVP acceptance).

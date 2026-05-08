---
title: FocusFox Overview
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# FocusFox - Overview

Firefox extension MVP that combines task/project management, a Pomodoro timer with classic cycle, hard tab blocking via a global allowlist, distraction tracking (auto + manual), a daily timeline of notes, and a 90-day stats dashboard. Local-only (IndexedDB) with JSON export/import.

## Goals

- Force intentional focus: every Pomodoro must be tied to a task.
- Make the cost of distraction visible in real time.
- Build a long-term picture (heatmap + per-project breakdown) without cloud sync.
- Stay tiny: zero backend, zero auth, zero analytics.

## Non-goals (MVP)

- Sync between devices.
- Mobile / Chromium / Safari support.
- Notifications outside the browser.
- Tags, due dates, recurring tasks, drag-and-drop reorder.
- Per-project allowlists.
- Global keyboard shortcuts (browser-level).

## Architecture

Three surfaces backed by one background script:

```
+-------------------+      +-------------------+      +-------------------+
|     Popup UI      |      |   Dashboard UI    |      |   Blocked page    |
|   (340x480 px)    |      | (full tab in app) |      |  (/blocked.html)  |
+---------+---------+      +---------+---------+      +---------+---------+
          |                          |                          |
          +--------------------------+--------------------------+
                                     |
                          browser.runtime messaging
                                     |
                          +----------v-----------+
                          |  Background script   |
                          |  (event page)        |
                          |                      |
                          | - Pomodoro engine    |
                          | - Tab blocker        |
                          | - DB layer (idb)     |
                          | - Message router     |
                          +----------+-----------+
                                     |
                          +----------v-----------+
                          |     IndexedDB        |
                          +----------------------+
```

UI surfaces never touch IndexedDB or `webRequest` directly. Everything goes through the background script via typed messages.

## Stack

| Layer | Choice | Rationale |
|---|---|---|
| Language | TypeScript strict | No `any`, per user preference. |
| UI | React 18 | User familiarity. |
| Bundler | Vite + `@crxjs/vite-plugin` | MV3 manifest support, HMR for popup/dashboard. |
| Storage | IndexedDB via `idb` | Spec 01 covers schema. |
| State (UI) | Zustand | Lightweight, no boilerplate. |
| Tests | Vitest | Engine + DB layer unit tests. |
| Packaging | `web-ext` | Build, lint manifest, sign for AMO. |
| Package manager | pnpm | Per user rule. |

## Manifest V3 (Firefox)

```jsonc
{
  "manifest_version": 3,
  "name": "FocusFox",
  "version": "0.1.0",
  "description": "Pomodoro + tasks + hard focus blocking.",
  "permissions": [
    "storage",
    "tabs",
    "webRequest",
    "webRequestBlocking",
    "alarms"
  ],
  "host_permissions": ["<all_urls>"],
  "background": {
    "scripts": ["background/index.js"],
    "type": "module"
  },
  "action": {
    "default_popup": "popup/index.html",
    "default_title": "FocusFox"
  },
  "browser_specific_settings": {
    "gecko": {
      "id": "focusfox@brian.dev",
      "strict_min_version": "115.0"
    }
  }
}
```

Note: `webRequestBlocking` is a Firefox-supported permission (not available on Chrome MV3). This is a Firefox-only extension by design.

## File structure

```
focusfox/
  manifest.json
  vite.config.ts
  package.json
  tsconfig.json
  src/
    background/
      index.ts
      router.ts                # message routing
      engine/                  # spec 03
      blocker/                 # spec 04
      db/                      # spec 01
    popup/
      index.html
      main.tsx
      App.tsx
      components/
    dashboard/
      index.html
      main.tsx
      routes/
        Today.tsx              # spec 06
        Tasks.tsx              # spec 02 + 09
        Stats.tsx              # spec 07
        Settings.tsx           # spec 11
    blocked/
      index.html
      main.tsx                 # spec 10
    shared/
      types.ts                 # cross-module types
      messages.ts              # request/response contract
      constants.ts
      time.ts                  # date helpers (day key, format)
  docs/specs/                  # this directory
  tests/
```

## Message bus contract

All UI -> background communication uses `browser.runtime.sendMessage` with a typed envelope. Long-lived connections (`browser.runtime.connect`) are used only for the popup's per-second tick stream.

```ts
// shared/messages.ts
export type Request =
  | { kind: 'projects.list' }
  | { kind: 'projects.create'; name: string; color: string }
  | { kind: 'tasks.list'; projectId: string }
  | { kind: 'tasks.create'; projectId: string; title: string; estimatedPomodoros?: number }
  | { kind: 'pomodoro.start'; taskId: string }
  | { kind: 'pomodoro.cancel' }
  | { kind: 'pomodoro.snapshot' }                  // current state
  | { kind: 'distraction.manual'; reason?: string }
  | { kind: 'notes.add'; text: string }
  | { kind: 'notes.listDay'; day: string }
  | { kind: 'stats.range'; days: 7 | 30 | 90 | 365 }
  | { kind: 'settings.get' }
  | { kind: 'settings.update'; patch: Partial<Settings> }
  | { kind: 'data.export' }
  | { kind: 'data.import'; payload: ExportPayload };

export type Response<R extends Request> = /* discriminated by kind */;

export type Tick = {
  state: 'idle' | 'work' | 'short_break' | 'long_break';
  remainingMs: number;
  task?: { id: string; title: string; projectId: string; projectName: string; projectColor: string };
  cycleIndex: number;          // 1..longBreakEvery
  distractionCountSession: number;
};
```

Each spec narrows `Request`/`Response` to its own message kinds.

## Background lifecycle

- Event page: stays alive while `port` from popup is open OR alarm is scheduled.
- On `runtime.onStartup` and `runtime.onInstalled`: open DB, hydrate engine state from `storage.local` (so a running Pomodoro survives a Firefox restart).
- `browser.alarms` is used to wake the background for state transitions (work end, break end). Per-second ticks happen only while the popup is open.

## Spec dependency graph

```
00-overview
  +-- 01-data-model
       +-- 02-projects-and-tasks
       +-- 03-pomodoro-engine
            +-- 04-focus-blocking
            +-- 05-distraction-tracking
            +-- 06-daily-timeline
       +-- 07-stats

UI specs depend on the above:
  08-ui-popup       (uses 02, 03, 05)
  09-ui-dashboard   (uses 02, 06, 07, 11)
  10-ui-blocked     (uses 03)
  11-ui-settings    (uses 01, 04)
```

Implementation order should follow this graph: data model first, then engine, then features, then UI shells, then polish.

## Acceptance for "MVP done"

- All 12 specs implemented and acceptance-criteria-met.
- Manual smoke test: install in Firefox via `web-ext run`, create a project, create a task, run a full work pomodoro with at least one blocked attempt, see the entry in the timeline, see it counted in stats.
- Vitest suite green for engine + DB layer.
- Manifest passes `web-ext lint`.

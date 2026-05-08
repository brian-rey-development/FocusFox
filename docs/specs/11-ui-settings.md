---
title: UI - Settings
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# UI - Settings

`<SettingsView>` is the full-width settings panel rendered by the dashboard at route `#settings`. It presents three card-style sections in a single column: Pomodoro timer configuration, the global allowlist, and data management (export, import, reset). Every field persists to the background immediately on change via `settings.update`; there is no save button. A transient "guardado" indicator next to each section heading confirms each successful write.

## Depends on

- `01-data-model` - `Settings`, `ExportPayload`, and all store types used in the import preview summary.
- `04-focus-blocking` - allowlist consumer; reads the fresh allowlist on each request, so edits here take effect on the next navigation check.

## Used by

- `09-ui-dashboard` - mounts `<SettingsView>` at the `#settings` hash route.

## Mount

The dashboard's router renders `<SettingsView>` when `location.hash === '#settings'`. No props are required; the component fetches its own initial state via `settings.get` on mount.

## Layout

Full-width single column. Each section is a `<SettingsSection>` card with a visible H2 heading, an optional "guardado" save indicator, and vertically stacked fields. Cards have a consistent border and padding. No tabs or accordions within the view.

## Section 1: Pomodoro

Fields use `<MinuteStepper>` for duration values and `<ToggleField>` for booleans.

### Duration steppers

| Field | Range (minutes) | Default |
|---|---|---|
| `workMs` | 1..120 | 25 |
| `shortBreakMs` | 1..60 | 5 |
| `longBreakMs` | 1..120 | 15 |

Each stepper displays the current value with a `min` suffix. The step size is dynamic: 1 for values under 30 minutes, 5 for values >= 30 minutes, making large adjustments fast without sacrificing fine control. Values are stored as milliseconds; the stepper converts internally using `msToMinutes` and `minutesToMs`.

### Cycle count stepper

`longBreakEvery`: range 2..10, default 4. No `min` suffix (unit is "work pomodoros"). Step is always 1.

### Toggle fields

| Field | Label | Default |
|---|---|---|
| `autoStartBreaks` | "Iniciar descanso automaticamente" | `true` |
| `autoStartNextWork` | "Iniciar siguiente pomodoro automaticamente" | `false` |

### Persistence

Each stepper's `onChange` fires `settings.update{ patch: { workMs: minutesToMs(v) } }` (or the relevant field). Toggle changes fire immediately without debounce. Duration and cycle fields debounce by 300 ms before sending the message.

### Mid-cycle behavior (documented, not enforced here)

Changing `longBreakEvery` mid-cycle: the new value is read at the next pomodoro start, not the current one. Changing any duration while a pomodoro is active has no effect on that pomodoro; the engine reads settings only at start time.

## Section 2: Allowlist

Header text: "Sitios permitidos durante un pomodoro". Explainer below the header: "Cuando estas en foco, solo podes navegar a estos dominios. Coincide con subdominios automaticamente."

### Domain list

`<DomainList>` renders each domain in `settings.allowlist` as a row with the domain name and a remove button. Clicking remove sends `settings.update{ patch: { allowlist: listWithoutDomain } }` immediately.

### Add input

`<DomainAddInput>` is a single-line text field with an "Agregar" button. Before adding:

1. Normalize via `normalizeDomain`: lowercase, strip leading `https://`, `http://`, strip leading `www.`.
2. Validate with `isValidDomain` using:

```ts
const DOMAIN_RE =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;
```

Reject IP addresses (a domain consisting only of numeric labels is an IP). Reject anything with a path component (slash after normalization).

3. Reject duplicates (case-insensitive comparison against existing list). Show inline error: "Este dominio ya esta en la lista."
4. On success, send `settings.update{ patch: { allowlist: [...existing, normalized] } }` and clear the input.

Inline validation error replaces the explainer text below the input. The Add button is disabled while the field is empty or the value is invalid.

### Empty state

When `allowlist` is empty, render the explainer plus a secondary note: "Si dejas la lista vacia, vas a bloquear todo cuando estes en foco."

### Removing a domain the user is currently viewing

Takes effect on the next navigation check. The current page remains loaded. This is documented behavior, not an error.

## Section 3: Data

### Export

A single "Exportar datos" button. On click:

1. Send `data.export` to the background and receive an `ExportPayload`.
2. Serialize to JSON (`JSON.stringify(payload, null, 2)`).
3. Build a filename: `focusfox-export-YYYYMMDD.json` from the current local date.
4. Download using `URL.createObjectURL(new Blob([json], { type: 'application/json' }))` and a synthetic `<a>` anchor click. Revoke the object URL after triggering.

### Import

A hidden `<input type="file" accept=".json">` triggered by an "Importar datos" button.

On file select:

1. Read the file as text via `FileReader`.
2. Parse JSON. If parsing fails, show inline error: "El archivo no es valido."
3. Validate `payload.formatVersion === 1`. Any other value: inline error "Version de formato no compatible."
4. If a pomodoro is currently active (detected from local engine state or a `pomodoro.snapshot` check), reject with inline error: "Cancela el pomodoro antes de importar datos."
5. On valid payload, set `importPreview` in local state to show `<ConfirmModal>` with summary:

```
Vas a reemplazar todos tus datos con:
- X proyectos
- Y tareas
- Z pomodoros
```

6. On confirm, send `data.import{ payload }` to the background. On success, reload the settings view via `settings.get` and show "guardado" on the Data section heading.
7. On cancel, clear `importPreview` and reset the file input.

### Reset all data

A red "Borrar todos los datos" button. Two-step confirmation:

1. On click, open `<ConfirmModal danger>` with:
   - Title: "Borrar todos los datos"
   - Body: "Vas a borrar todo. Esta accion es irreversible."
   - `<TypeToConfirmInput requiredText="BORRAR">` - the confirm button remains disabled until the typed value equals `"BORRAR"` exactly (case-sensitive).
2. On confirm, send `{ kind: 'data.reset' }` to the background, then reload the view.

Note: `data.reset` is not in the current message bus contract in spec 00; it must be added when implementing this spec.

### Metadata footer

Optional. If present, renders:
- Extension version (from `browser.runtime.getManifest().version`).
- Schema version (from `meta.schemaVersion` via `settings.get` or a separate `meta.get` message).
- Total counts: projects, tasks, pomodoros.
- Last export timestamp (stored in `meta` under `lastExportAt`, written by the background on each `data.export`).

## Component inventory

```ts
// Root view
<SettingsView />

// Card wrapper with optional save indicator
<SettingsSection title: string />

// Numeric stepper for minute values
interface MinuteStepperProps {
  label: string;
  value: number;          // in minutes
  onChange: (minutes: number) => void;
  min: number;
  max: number;
  step?: number;          // if omitted, computed dynamically (1 or 5)
  showSuffix?: boolean;   // defaults true, renders "min"
}

// Boolean toggle with label and optional description
interface ToggleFieldProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}

// List of domains with remove buttons
interface DomainListProps {
  domains: string[];
  onChange: (updated: string[]) => void;
}

// Domain input with validation
interface DomainAddInputProps {
  onAdd: (domain: string) => void;
  existing: string[];
}

// Export / import / reset actions
interface DataActionsProps {
  onExport: () => void;
  onImport: (file: File) => void;
  onReset: () => void;
}

// Generic confirmation modal
interface ConfirmModalProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
  confirmDisabled?: boolean;
}

// Text input that enables confirm only when value matches required string
interface TypeToConfirmInputProps {
  requiredText: string;
  value: string;
  onChange: (v: string) => void;
}
```

## Local state shape

```ts
type SettingsViewState = {
  settings: Settings | null;
  saving: 'idle' | 'saving' | 'saved' | 'error';
  importPreview: ExportPayload | null;
  resetConfirmTyped: string;
};
```

`saving` drives the "guardado" affordance. It transitions: `idle -> saving -> saved` (fades after 1 s back to `idle`) or `idle -> saving -> error` on a failed message.

## Validation helpers

```ts
// Strip protocol and leading www., then lowercase.
function normalizeDomain(input: string): string;

// Returns true only for valid public domain names.
// Rejects IPs (all-numeric labels), paths, and single-label names.
function isValidDomain(d: string): boolean;

// Clamp a number to [min, max].
function clampMinutes(value: number, min: number, max: number): number;

// Convert milliseconds to whole minutes (floor).
function msToMinutes(ms: number): number;

// Convert minutes to milliseconds.
function minutesToMs(minutes: number): number;
```

All five helpers are pure functions with no side effects, making them trivially testable.

## Acceptance

- Changing `workMs` from 25 to 30 minutes in the stepper immediately sends `settings.update` with `workMs: 1_800_000`; the next pomodoro started via the popup uses the 30-minute duration.
- Adding "github.com" via `<DomainAddInput>` persists it; closing and reopening the dashboard shows it in the list.
- Attempting to add "github.com" a second time shows the inline duplicate error and leaves the list unchanged.
- Entering "https://www.github.com/foo" in the add input normalizes to "github.com" and persists successfully.
- Exporting, wiping data via reset, and re-importing the exported file restores all projects, tasks, and pomodoros.
- The "Borrar todos los datos" confirm button remains disabled until the user types `BORRAR` exactly.
- All interactive elements (steppers, toggles, add input, remove buttons, export/import/reset buttons, modal confirm/cancel) are reachable and operable via keyboard.
- Vitest unit tests cover `normalizeDomain` (strips protocol, strips www, lowercases), `isValidDomain` (accepts valid domains, rejects IPs, rejects single labels, rejects paths), `clampMinutes` (boundary values), and the import preview summary logic (correct counts from a fixture payload).

## Out of scope

- Theme switching or appearance preferences.
- Language switcher (UI language is fixed in MVP).
- Keyboard shortcut customization.
- Sound or notification preferences.
- Syncing settings across devices or profiles.
- Regex-based or wildcard allowlist entries.
- Time-of-day-based or per-project settings.
- Merge mode for import (replace-all only in MVP).

---
title: UI - Blocked Page
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# UI - Blocked Page

The page shown when the focus blocker intercepts a navigation during an active work pomodoro. It replaces the destination tab with a centered card that displays the current task, remaining time, and today's stats. The only escape is cancelling the active pomodoro - there is no bypass-once button. Once the pomodoro ends or is cancelled, the page automatically redirects to the original URL.

## Depends on

- `03-pomodoro-engine` - `pomodoro.snapshot` request, `tick` port, `pomodoro.cancel` request.
- `07-stats` - `stats.today` request for today's work pomodoros, distractions, and streak.
- `04-focus-blocking` - the caller that redirects to this page.

## Used by

Nothing. This is a terminal surface; no other spec links to it.

## URL contract

```
moz-extension://<id>/blocked/index.html?url=<encodedOriginalUrl>&domain=<domain>
```

- `url` - `encodeURIComponent` of the full original destination URL.
- `domain` - the eTLD+1 of the intercepted request (provided by the blocker for display).
- Both parameters are optional defensively. Missing `url` defaults to `''`; missing `domain` defaults to `'unknown'`.

## Entry point

```
blocked/
  index.html   -- loads blocked/main.tsx
  main.tsx     -- renders <App /> into #root
  App.tsx      -- top-level component, all mount logic lives here
```

## Query parsing

```ts
function parseBlockedParams(search: string): { originalUrl: string; domain: string } {
  const params = new URLSearchParams(search);
  const raw = params.get('url') ?? '';
  const domain = params.get('domain') ?? 'unknown';
  let originalUrl = '';
  try {
    originalUrl = raw ? decodeURIComponent(raw) : '';
  } catch {
    originalUrl = '';
  }
  return { originalUrl, domain };
}
```

Decoding errors are swallowed; the page falls back to `about:home` for any redirect that requires `originalUrl`.

## Mount sequence

On mount, `App` runs the following in order:

1. Parse `originalUrl` and `domain` from `window.location.search`.
2. Send `{ kind: 'pomodoro.snapshot' }` via `browser.runtime.sendMessage`. Timeout: 2000 ms.
3. If the request times out or the background is unreachable, surface an error toast with a "Reintentar" button. Do not render the blocked card. The retry button re-runs the mount sequence.
4. If `snapshot.state !== 'work'`, call `window.location.replace(originalUrl || 'about:home')` immediately and return without rendering anything.
5. Send `{ kind: 'stats.today' }` to fetch `TodayStats`.
6. Open a long-lived port: `browser.runtime.connect({ name: 'tick' })`.
7. Render the blocked UI with snapshot data and today's stats.

No loading spinner is shown for step 5 - today's stats are non-critical. If the stats request fails, the `<TodayMiniStats>` component renders with zeroed values.

## Live update contract

The `tick` port receives `Tick` messages (see `shared/messages.ts`). On each message:

- Update `remainingMs` in local state.
- If `tick.state !== 'work'` (pomodoro completed or cancelled), call `window.location.replace(originalUrl || 'about:home')`.

## Zustand store (local to this page)

```ts
interface BlockedStore {
  snapshot: PomodoroSnapshot | null;
  remainingMs: number;
  today: TodayStats | null;
  streakDays: number;
  error: 'unreachable' | null;
  confirmCancel: boolean;

  setSnapshot(s: PomodoroSnapshot): void;
  setRemainingMs(ms: number): void;
  setToday(t: TodayStats, streakDays: number): void;
  setError(e: BlockedStore['error']): void;
  setConfirmCancel(v: boolean): void;
}
```

The store is created with `create<BlockedStore>(...)` scoped to this page. It is not shared with popup or dashboard.

## Component tree

```
<Stage>
  <BlockedHeader />
  <TaskTimeCard ... />
  <TodayMiniStats ... />
  <CancelLink onCancel={handleCancel} />
  <AttemptedUrl url={domain} />
</Stage>
<ErrorToast visible={error === 'unreachable'} onRetry={retry} />
```

## Component prop interfaces

```ts
// No external props - reads from store and query params internally
type BlockedAppProps = Record<string, never>;

interface TaskTimeCardProps {
  task: { id: string; title: string };
  project: { name: string; color: ProjectColor };
  remainingMs: number;
  cycleIndex: number;
  longBreakEvery: number;
}

interface TodayMiniStatsProps {
  today: { workPomodoros: number; distractions: number };
  streakDays: number;
}

interface CancelLinkProps {
  onCancel(): Promise<void>;
}

interface AttemptedUrlProps {
  url: string; // the domain or full URL to display
}
```

## Component specs

### `<Stage>`

Wrapper div covering the full viewport. Applies:
- Background: `radial-gradient(circle at 50% 0%, rgba(232, 164, 79, 0.08), transparent 70%) #0d0f12`.
- Grid overlay: `repeating-linear-gradient` at 0 deg and 90 deg, 40 px squares, lines at 2% opacity (`rgba(255,255,255,0.02)`).
- Grid is masked by a centered radial mask (`mask-image: radial-gradient(ellipse 80% 60% at 50% 50%, black, transparent)`) to avoid harsh edges.
- Flex column, centered both axes, min-height 100dvh.

### `<BlockedHeader>`

- A 56x56 container with a 1.5 px amber border (`#e8a44f`) and 12 px border-radius. Contains a clock icon (24x24, amber fill).
- Below the container: `<h1>` with text "Estas en foco." - 20 px, 600 weight, `#f5f5f5`.
- Below h1: `<p>` subtitle - 14 px, `#8a8a8a`, max-width 400 px, centered.
  Subtitle text: "Este sitio no esta en tu allowlist. Volvete a tu tarea o cancela el pomodoro si es una emergencia."

### `<TaskTimeCard>`

Bordered card (1 px `#2a2a2a` border, 12 px radius, `#111316` background, min-width 380 px, padding 24 px). Two-column layout:

Left column:
- Label "TAREA ACTUAL" - 10 px, uppercase, letter-spacing 0.08 em, `#8a8a8a`.
- Task title - 15 px, 500 weight, `#f5f5f5`, max 2 lines, text-overflow ellipsis.
- Meta line - 13 px, `#6a6a6a`: `${project.name} - ${cycleIndex} / ${longBreakEvery} pomodoros`.

Right column:
- Large time display - 36 px, JetBrains Mono (with monospace fallback), `font-variant-numeric: tabular-nums`, `#e8a44f`. Format: `MM:SS`.
- Label "restantes" - 11 px, `#6a6a6a`, below the time.

The `remainingMs` to `MM:SS` conversion:

```ts
function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
```

### `<TodayMiniStats>`

Horizontal row of three pill-shaped stat chips (gap 12 px):
- "N pomodoros hoy" where N = `today.workPomodoros`.
- "N distracciones" where N = `today.distractions`.
- "Nd racha" where N = `streakDays`.

Each chip: 12 px padding horizontal, 6 px vertical, `#1a1d22` background, 1 px `#2a2a2a` border, 6 px radius, 12 px text, `#8a8a8a` color.

### `<CancelLink>`

Semantically a `<button>` (not an anchor), default-styled to look like a subtle text link:
- Text: "cancelar pomodoro y desbloquear".
- Color: `#6a6a6a` at rest; `#e05252` on hover.
- 13 px, no underline at rest, underline on hover.
- Clicking sets `confirmCancel = true` in store, which shows the inline confirmation.

Inline confirmation (rendered inside or immediately below the button when `confirmCancel` is true):
- Text: "Seguro? Vas a perder este pomodoro."
- Two buttons side by side:
  - "Si, cancelar" - 12 px, `#e05252`, calls `onCancel()`.
  - "Volver" - 12 px, `#8a8a8a`, sets `confirmCancel = false`.

### `<AttemptedUrl>`

Monospace pill showing the blocked domain or URL:
- Background `#1a1d22`, border `#2a2a2a`, 6 px radius, 8 px 14 px padding.
- 12 px, JetBrains Mono fallback monospace, `#6a6a6a`.
- Content truncated to 60 chars with `...` suffix if longer. `title` attribute holds the full value.

### `<ErrorToast>`

Small fixed-position toast at top-center when `error === 'unreachable'`:
- Text: "No se pudo contactar al motor. Intenta de nuevo."
- A "Reintentar" button that calls `onRetry`.
- Background `#1a1d22`, amber left border 3 px, 12 px padding, 8 px radius.

## Cancel flow

```ts
async function handleCancel(): Promise<void> {
  const response = await browser.runtime.sendMessage({ kind: 'pomodoro.cancel' });
  if (response.ok) {
    window.location.replace(originalUrl || 'about:home');
  }
  // On error, keep the page open - the user sees the confirmation UI still
}
```

The redirect after cancel is idempotent with the tick-driven redirect. Whichever fires first wins; the second `window.location.replace` is a no-op on an already-navigating tab.

## Behavior corner cases

| Scenario | Behavior |
|---|---|
| `url` param missing | All redirects use `about:home` |
| `domain` param missing | `<AttemptedUrl>` shows `'unknown'` |
| Background unreachable on mount (>2 s) | Error toast with retry. Card not rendered. |
| Background unreachable during retry | Same toast again |
| Pomodoro completes naturally | Tick delivers `state !== 'work'`, page redirects |
| Pomodoro cancelled from popup | Same tick-driven redirect |
| User presses browser back button | Normal navigation - no special handling needed. Re-navigation to the same domain triggers the blocker again. |
| `decodeURIComponent` throws | `originalUrl` defaults to `''`, fallback to `about:home` |

## Accessibility

- Page has exactly one `<h1>` (inside `<BlockedHeader>`).
- `<CancelLink>` renders as `<button>`, keyboard-focusable and activatable via Enter/Space.
- Remaining time container has `aria-live="polite"` and `aria-atomic="true"`. To avoid reading every second, the announced value updates only when the minute changes (tracked via a `useEffect` that compares `Math.floor(remainingMs / 60_000)`).
- All interactive elements have `:focus-visible` outlines (`outline: 2px solid #e8a44f`).
- Amber text on dark background (`#e8a44f` on `#0d0f12`) achieves at least 4.5:1 contrast ratio.
- Body text (`#f5f5f5` on `#0d0f12`) achieves at least 15:1 contrast ratio.

## Visual summary

- Max card width: 760 px.
- Card min-height: 480 px (the outer Stage, not the inner TaskTimeCard).
- Overall vertical rhythm: BlockedHeader -> 32 px gap -> TaskTimeCard -> 24 px gap -> TodayMiniStats -> 32 px gap -> CancelLink -> 16 px gap -> AttemptedUrl.

## Acceptance

- Loading the page while pomodoro state is `'work'` renders the blocked UI with the correct task title and remaining time from the snapshot.
- Loading the page while pomodoro state is anything other than `'work'` calls `window.location.replace` immediately with the decoded original URL, without rendering the blocked card.
- Remaining time in `<TaskTimeCard>` updates each second as tick messages arrive.
- Clicking "cancelar pomodoro y desbloquear" shows the inline confirmation. Clicking "Volver" dismisses it without cancelling.
- Clicking "Si, cancelar" in the confirmation sends `pomodoro.cancel` and, on `{ ok: true }`, redirects to `originalUrl` via `window.location.replace`.
- If the engine completes the pomodoro naturally while the blocked page is open, the next tick with `state !== 'work'` triggers an automatic redirect.
- If the `url` query param is absent, all redirect targets fall back to `about:home`.
- If the background is unreachable for more than 2 s on mount, the error toast is shown and the blocked card is not rendered. The retry button re-attempts the mount sequence.
- Vitest unit tests cover:
  - `parseBlockedParams` - missing params, malformed encoding, normal input.
  - Redirect guard - component unmounts/redirects when snapshot state is not `'work'`.
  - Tick handler - `remainingMs` state updates correctly on incoming tick messages.
  - Cancel flow - confirmation toggle, `pomodoro.cancel` message dispatch, redirect on `{ ok: true }`.
  - `formatRemaining` - boundary values (0 ms, 59_999 ms, 60_000 ms, 25 * 60_000 ms).

## Out of scope

- Bypass-once button.
- Motivational quotes.
- Custom illustrations or artwork.
- Audio or visual sounds.
- Themes other than the dark default.
- Per-domain block reasons or context.
- Distraction logging from this page (handled by `04-focus-blocking` before the redirect occurs).

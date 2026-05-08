---
title: Focus Blocking
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Focus Blocking

The background module that intercepts all main-frame navigation during a work Pomodoro, compares the destination hostname against the global allowlist, and hard-redirects blocked requests to the extension's blocked page. The listener is registered once at background startup and remains active for the extension's lifetime, becoming a no-op via early return when the engine is not in the `work` state.

## Depends on

- `03-pomodoro-engine` - exposes `engine.currentState()` synchronously and `engine.currentPomodoroId()` for event payloads.
- `01-data-model` - `Settings.allowlist` is the source of truth for allowed domains.

## Used by

- `05-distraction-tracking` - consumes `focus.blocked_attempt` events to create `Distraction` records.
- `10-ui-blocked-page` - the redirect target; reads back the original URL from query params.

## Permissions

Firefox MV3 requires explicit permissions for blocking webRequest. Add to `manifest.json`:

```jsonc
{
  "permissions": ["webRequest", "webRequestBlocking"],
  "host_permissions": ["<all_urls>"]
}
```

`webRequestBlocking` is a Firefox-only permission. Chrome MV3 dropped synchronous blocking webRequest in favour of declarativeNetRequest; this extension targets Firefox exclusively and does not support Chrome.

## Module location

`src/background/blocker/index.ts`

## Types

```ts
// src/shared/types.ts (additions)

export interface BlockedAttemptEvent {
  url: string;
  domain: string;
  at: number;
  pomodoroId: string;
}

// Returned by shouldBlock to keep handler logic flat
export interface BlockDecision {
  block: boolean;
  domain: string | null;
}
```

## Allowlist cache

Reading IndexedDB on every request would be async and incompatible with the synchronous `webRequest` blocking API. Instead, maintain an in-memory copy that is populated once at startup and invalidated whenever settings change.

```ts
// src/background/blocker/allowlist-cache.ts

let cached: string[] = [];

export function getAllowlist(): string[] {
  return cached;
}

export function setAllowlist(domains: string[]): void {
  cached = domains.map(d => d.toLowerCase().trim()).filter(Boolean);
}
```

The background router calls `setAllowlist(settings.allowlist)` on startup (after DB hydration) and again after every successful `settings.update` message. This ensures any allowlist edit from the settings UI reflects on the very next request.

## Helper functions

```ts
/**
 * Determines whether a navigation request should be blocked.
 * Pure function - no side effects - suitable for unit tests.
 */
function shouldBlock(
  url: string,
  allowlist: string[],
  extId: string,
  state: PomodoroState,
): BlockDecision;

/**
 * Returns true if hostname matches a domain entry exactly
 * or as a subdomain (e.g. 'docs.github.com' matches 'github.com').
 * Comparison is case-insensitive; caller must lowercase both sides.
 */
function isAllowedDomain(hostname: string, allowlist: string[]): boolean;

/**
 * Builds the redirect URL for the blocked page, encoding the original
 * URL and domain as query parameters.
 */
function buildBlockedUrl(originalUrl: string, domain: string, extId: string): string;
```

### shouldBlock logic (pseudocode)

```
if state !== 'work'        -> { block: false, domain: null }

parse hostname from url
  on failure               -> { block: false, domain: null }

if protocol in ALWAYS_ALLOW_PROTOCOLS
                           -> { block: false, domain: null }

if hostname matches moz-extension://<extId> host
                           -> { block: false, domain: null }

if isAllowedDomain(hostname.toLowerCase(), allowlist)
                           -> { block: false, domain: hostname }

                           -> { block: true,  domain: hostname }
```

### Always-allowed protocols

```ts
const ALWAYS_ALLOW_PROTOCOLS = new Set([
  'moz-extension:',
  'about:',
  'file:',
  'chrome:',
  'data:',
  'view-source:',
]);
```

### isAllowedDomain logic

```ts
// For each entry d in allowlist (already lowercased):
//   exact match:    hostname === d
//   subdomain match: hostname.endsWith('.' + d)
// Return true on first match, false if none match.
```

An empty allowlist returns `false` for every hostname, meaning all external navigation is blocked during `work`. The always-allow protocols still take effect before this check is reached.

### buildBlockedUrl

```
`moz-extension://${extId}/blocked/index.html?url=${encodeURIComponent(originalUrl)}&domain=${encodeURIComponent(domain)}`
```

## Listener registration

Registered exactly once during background initialization, before any alarm or port can fire.

```ts
// src/background/blocker/index.ts

export function registerBlocker(engine: PomodoroEngine, extId: string): void {
  browser.webRequest.onBeforeRequest.addListener(
    (details) => handleRequest(details, engine, extId),
    { urls: ['<all_urls>'], types: ['main_frame'] },
    ['blocking'],
  );
}
```

`registerBlocker` is called from `src/background/index.ts` after DB hydration and engine hydration complete.

## Request handler

```ts
function handleRequest(
  details: browser.webRequest.WebRequestBodyDetails,
  engine: PomodoroEngine,
  extId: string,
): browser.webRequest.BlockingResponse {
  const state = engine.currentState();
  const allowlist = getAllowlist();
  const decision = shouldBlock(details.url, allowlist, extId, state);

  if (!decision.block) return {};

  const pomodoroId = engine.currentPomodoroId();

  // Fire-and-forget - do not await inside a blocking listener
  emitBlockedAttempt({
    url: details.url,
    domain: decision.domain!,
    at: Date.now(),
    pomodoroId: pomodoroId ?? '',
  });

  return {
    redirectUrl: buildBlockedUrl(details.url, decision.domain!, extId),
  };
}
```

The handler is synchronous. `emitBlockedAttempt` posts the event to a queue processed by spec 05; it must not block the return.

## Event emission

```ts
// src/background/blocker/events.ts

export function emitBlockedAttempt(event: BlockedAttemptEvent): void {
  // Posts to the internal event bus consumed by DistractionTracker (spec 05).
  // Implementation: simple in-memory EventEmitter or direct service call.
  distractionTracker.onBlockedAttempt(event);
}
```

The `focus.blocked_attempt` event payload is `BlockedAttemptEvent`. Spec 05 owns persistence; this module only emits.

## Engine interface (subset used here)

```ts
// src/background/engine/types.ts (excerpt)

type PomodoroState = 'idle' | 'work' | 'short_break' | 'long_break';

interface PomodoroEngine {
  // Synchronous read from in-memory state - no async, safe inside blocking listener
  currentState(): PomodoroState;
  currentPomodoroId(): string | null;
}
```

The engine holds state in memory and persists to IndexedDB asynchronously. The blocking handler reads only the in-memory getter, so it is never async.

## State transition behavior

When the engine transitions out of `work` (e.g. to `short_break` or `idle`), the handler reads the new state on the next request and returns `{}` immediately. No listener deregistration is needed. The listener is intentionally always registered; it costs nothing when state is not `work`.

## Edge case: in-flight redirect after state change

A navigation that starts while state is `work` will have already received the redirect response before any state transition completes. The blocked page handles this gracefully: on load it checks the engine state via `browser.runtime.sendMessage` and redirects the user back to the original URL if the Pomodoro is no longer running (see spec 10).

## Initialization sequence

```
background/index.ts
  1. openDB()
  2. hydrateEngine(db)          // engine.currentState() now reliable
  3. settings = await db.getSettings()
  4. setAllowlist(settings.allowlist)
  5. registerBlocker(engine, browser.runtime.id)
  6. registerMessageRouter()
```

Settings update path:

```
settings.update message
  -> db.updateSettings(patch)
  -> setAllowlist(newSettings.allowlist)   // cache invalidated synchronously
  -> broadcast data-changed
```

## Acceptance

- During `work`, a request to a domain not in the allowlist returns a `redirectUrl` pointing to `/blocked/index.html` with the original URL preserved as a query parameter.
- During `work`, a request to a domain that exactly matches an allowlist entry (e.g. `github.com`) returns `{}` (allowed).
- During `work`, a request to a subdomain (e.g. `docs.github.com`) is allowed when its root domain (`github.com`) is in the allowlist.
- During `short_break`, `long_break`, or `idle`, no request is blocked regardless of URL.
- `moz-extension://`, `about:`, `file:`, `chrome:`, `data:`, and `view-source:` URLs are never blocked in any state.
- Updating the allowlist via `settings.update` reflects on the very next request without reloading the extension.
- An empty allowlist blocks every external main-frame request during `work`; always-allow protocols still pass through.
- A `focus.blocked_attempt` event with `{url, domain, at, pomodoroId}` is emitted for each blocked request; spec 05 consumes it.
- Vitest unit tests for `shouldBlock` cover:
  - empty allowlist blocks external HTTP
  - exact domain match allows
  - subdomain match allows (e.g. `docs.github.com` with `github.com` in list)
  - case-insensitive match (e.g. `GitHub.com` in list, `github.com` requested)
  - `about:blank` and `moz-extension:` are always allowed
  - malformed URL string returns allowed (fail open)
  - non-`work` state returns allowed regardless of URL

## Out of scope

- Per-project allowlists.
- Regex or glob patterns in the allowlist.
- Time-based allowlist windows (e.g. allowed during lunch break).
- Blocking sub-resources (scripts, images, XHR) on non-allowlisted domains within an otherwise-allowed page.
- Blocking iframes embedded inside an allowed page.
- Per-session override ("allow just this once") - cancelling the Pomodoro is the only escape.

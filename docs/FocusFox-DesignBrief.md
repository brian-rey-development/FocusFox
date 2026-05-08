# FocusFox — Design Brief

**Product:** Firefox extension MVP that combines task/project management, a Pomodoro timer with hard tab blocking, distraction tracking, a daily timeline, and a 90-day stats dashboard.

**Stack:** TypeScript strict, React 18, Vite, Zustand, IndexedDB via `idb`. Firefox-only (Manifest V3).

**Extension pages:** Popup (340x480), Dashboard (full tab), Blocked Page (redirect target).

---

## Design Philosophy

Make the cost of distraction visible. The visual system should feel warm, focused, and a little premium — not cold or clinical. The amber accent is the hero color; it signals activity, urgency, and warmth.

---

## Design Tokens

| Token | Value |
|---|---|
| Background (primary) | `#0d0f12` |
| Background (elevated) | `#131619` |
| Background (card) | `#1a1d22` |
| Accent (primary) | `#e8a44f` |
| Accent (glow) | `#f5b765` → `#d18a32` (gradient stops) |
| Text primary | `#f0ede8` |
| Text secondary | `#8a8480` |
| Text muted | `#6a6a6a` |
| Danger | `#e05252` |
| Border (subtle) | `rgba(255,255,255,0.06)` |
| Border (card) | `rgba(255,255,255,0.10)` |

**Fonts:** Inter for UI text, JetBrains Mono for timer displays and numeric values.

**Border radius:** 8px for cards, 6px for buttons, 12px for large surfaces.

---

## Popup (340x480 px, dark theme)

**Layout:** Fixed box. No scrollbars on default content. Dark radial glow at top creates warmth.

**Background gradient:**
```
radial-gradient(ellipse at 50% -20%, rgba(232,164,79,0.12) 0%, transparent 70%)
```

**States:**
- **Loading** — minimal spinner or nothing shown
- **Idle** — task selector (project groups in `<optgroup>`), estimate stepper (`-` / count / `+`), "Iniciar pomodoro" button
- **Active** — SVG ring timer (196px, 5px stroke, amber gradient arc), task card with project color tag, distraction counter + "Me distraje" button
- **Break** — same ring with "descanso corto" or "descanso largo" label, "Saltar descanso" button
- **Error** — message + "Reintentar" button

**Active ring:**
- SVG circle with `stroke-dasharray`/`stroke-dashoffset` for progress arc
- Gradient: stop1 `#f5b765`, stop2 `#d18a32`
- Drop shadow via `feDropShadow` in amber
- Center: MM:SS in JetBrains Mono, tabular numerals
- Pulse dot at arc tip, CSS `@keyframes` opacity pulse
- `aria-live="polite"`, `aria-label` updated only on minute change

**Idle task selector:**
- `<select>` with `<optgroup label={project.name}>` per project
- Only non-archived projects with at least one active task appear
- Empty state: link to create project from dashboard

**Estimate stepper:** `-` / numeric display / `+`. Min 1, max 20. Disabled at boundaries.

**Distraction row:** Session counter + "Me distraje" button. Manual input appears inline below (text field + submit/cancel). Enter submits, Escape cancels.

**Cancel confirmation:** Inline confirm replaces distraction area. "Cancelar pomodoro? Se registrara como no completado." Two buttons: "Si, cancelar" and "No, continuar".

---

## Dashboard (full tab)

**Shell:** 240px fixed sidebar + flexible main area. Sidebar `#131619`, main `#1a1d22`. 1px border between them.

**Sidebar sections:**
- Brand header (fox SVG + wordmark)
- NavSection "Vistas": Hoy, Tareas, Stats
- NavSection "Proyectos": color-dot project list + add button
- MiniTimer (visible only when `tick.state === 'work'`)

**Sidebar collapse:** `min-width: 1024px`; below 800px optional hamburger. (Optional polish, not MVP-required.)

**NavItem:** icon + label + optional shortcut key badge. `aria-current="page"` when active. Active state: `rgba(232, 164, 79, 0.12)` background + `2px solid #e8a44f` left border.

**MiniTimer:** Amber pulsing ring (same as popup), `mm:ss` in JetBrains Mono, task title truncated to one line. Pulse suppressed via `prefers-reduced-motion`.

**Topbar:** Segmented control for Hoy / Tareas / Stats tabs. Settings accessible via gear icon. Active tab: highlighted background. Right slot for range selector on Stats.

**ProjectCreateModal:** Centered overlay, `backdrop-filter: blur(4px)`. Fields: name input + 6-color swatch picker. Selected swatch has 2px amber ring. Focus trap, Escape closes.

**Heatmap (Stats):** 12px squares, 3px gap, 5 levels from transparent (0 pomodoros) to full amber (7+). 7 / 30 / 90 / 365 day ranges.

**Stat cards:** 1px top edge highlight: `linear-gradient(to bottom, rgba(255,255,255,0.08), transparent)`.

**Toast stack:** Fixed bottom-right, auto-dismisses 4s, max 3 visible.

**Keyboard shortcuts:**
- `1` → #hoy
- `2` → #tareas
- `3` → #stats
- `n` → focus new-input for active tab
- `?` → shortcuts cheatsheet overlay

---

## Blocked Page (full viewport, shown on intercepted navigation)

**Background:** radial gradient + subtle grid overlay (40px squares, 2% opacity lines), masked by centered radial ellipse to avoid harsh edges.

**BlockedHeader:** 56x56 container, 1.5px amber border, 12px radius, clock icon inside. Below: "Estas en foco." (20px, 600 weight) + subtitle explaining the block.

**TaskTimeCard:** Bordered card (1px `#2a2a2a`, 12px radius, `#111316` background). Two-column:
- Left: "TAREA ACTUAL" label (10px uppercase) + task title (15px, max 2 lines) + project name + cycle counter
- Right: `MM:SS` in JetBrains Mono (36px, amber)

**TodayMiniStats:** Three pill chips side by side: "N pomodoros hoy", "N distracciones", "Nd racha". `#1a1d22` background, 1px border, 6px radius.

**CancelLink:** Button styled as text link. Color `#6a6a6a` at rest, `#e05252` on hover. Inline confirmation appears below: "Seguro? Vas a perder este pomodoro." + "Si, cancelar" / "Volver".

**AttemptedUrl:** Monospace pill showing blocked domain (truncated to 60 chars). `#1a1d22` background, `#2a2a2a` border.

**ErrorToast:** Top-center, "No se pudo contactar al motor. Intenta de nuevo." Amber left border 3px.

**Redirect behavior:** Once pomodoro ends or is cancelled, page auto-redirects to original URL.

---

## Color Palette Reference (ProjectColors)

Six project colors defined in constants:

| Name | Hex |
|---|---|
| blue | `#4a9eff` |
| amber | `#e8a44f` |
| green | `#4ade80` |
| purple | `#a78bfa` |
| red | `#f87171` |
| cyan | `#22d3ee` |

---

## Typography Scale

| Element | Font | Size | Weight |
|---|---|---|---|
| H1 (blocked page) | Inter | 20px | 600 |
| H2 (settings section) | Inter | 16px | 600 |
| Body | Inter | 14px | 400 |
| Small/meta | Inter | 12px | 400 |
| Tiny label | Inter | 10px | 400, uppercase, letter-spacing 0.08em |
| Timer display | JetBrains Mono | 36px | (tabular nums) |
| Ring center time | JetBrains Mono | (varies) | (tabular nums) |
| Stat values | JetBrains Mono | 12px | 400 |
| Code/URL pills | JetBrains Mono | 12px | 400 |

---

## Component Patterns

**Buttons:** 6px radius, `#e8a44f` background for primary, transparent with border for secondary. Always have `outline: 2px solid #e8a44f; outline-offset: 2px` on focus. Never remove focus styles.

**Inputs:** Dark background (`#1a1d22`), 1px `#2a2a2a` border, 6px radius. Focus: amber border `#e8a44f`.

**Cards:** `#1a1d22` background, 1px `#2a2a2a` border, 8px radius. Top-edge highlight optional.

**Modals:** Centered, max-width 480px, `backdrop-filter: blur(4px)`, `#1a1d22` background, 1px `rgba(255,255,255,0.10)` border.

**Kebab menus:** Shown only on user-owned items (notes, tasks). Auto entries have no actions.

---

## Accessibility Checklist

- All interactive elements: visible focus ring (`outline: 2px solid #e8a44f; outline-offset: 2px`)
- Color is never the sole signal — text labels always accompany color cues
- All `<button>` elements have `aria-label` when label text is not descriptive in isolation
- Ring timer: `role="timer"`, `aria-live="polite"`, `aria-atomic="true"`
- Modals: `role="dialog"`, `aria-modal="true"`, `aria-labelledby`
- Nav sections: `<nav aria-label="...">`
- Skip link to `#main-content` on dashboard
- Tab order: skip link → sidebar nav → sidebar project list → topbar → main content
- Amber on dark (`#e8a44f` on `#0d0f12`) achieves 4.5:1+ contrast ratio

---

## Empty States (Spanish)

- Popup task selector (no projects): "Crea un proyecto desde el dashboard"
- Popup task selector (no tasks in project): "+ nueva tarea" link
- Dashboard Today (no entries): "Aun no hay registros de hoy. Empezar un pomodoro o anotar algo?"
- Dashboard Tasks (no project selected): "Selecciona un proyecto en la barra lateral o crea uno nuevo."
- Dashboard Tasks (no tasks): "Aun no hay tareas en este proyecto. Crea una arriba."
- Dashboard Stats (no data): "Cuando completes tu primer pomodoro, vas a verlo aqui."

---

## Key Animations

| Element | Animation |
|---|---|
| Ring progress arc | `stroke-dashoffset` transition 1s linear |
| Arc tip pulse dot | `@keyframes pulse` — opacity 1→0.5→1 |
| MiniTimer | Expanding ring pulse, suppressed via `prefers-reduced-motion` |
| Toast appear | Fade in + slide up |
| Toast dismiss | Fade out after 4s |
| Modal open | Fade in backdrop, scale-up card |
| NavItem active | Border color transition 150ms |

---

## Deliverables

For MVP, provide:
- Popup layout and all states (idle, active, break, error)
- Dashboard shell layout (sidebar + main area)
- All route views: Today, Tasks, Stats, Settings
- Blocked page full layout
- Project create modal
- Settings sections (Pomodoro, Allowlist, Data)
- Color swatches for 6 project colors
- All component states (default, hover, active, disabled, focus, error)
- Empty state designs for all lists
- Toast / confirmation patterns
---
title: Statistics
type: spec
status: draft
created: 2026-05-08
updated: 2026-05-08
---

# Statistics

Pure read service that computes aggregated productivity stats over user history stored in IndexedDB. All computation is on-demand with no caching layer. Functions are pure: they take pomodoros, distractions, and projects as inputs and return typed aggregations without side effects. The background script exposes these via the message bus so UI surfaces never query IndexedDB directly.

## Depends on

- `01-data-model` - `Pomodoro`, `Distraction`, `Project` types; `DB` interface; `listPomodorosForRange`, `listDistractionsForPomodoro`, `listProjects`; `dayKey` from `shared/time.ts`.

## Used by

- `09-ui-dashboard` - Stats tab (heatmap, streak, project breakdown, week summary).
- `10-ui-blocked-page` - Today's pomodoro count shown on the blocked tab page.

## Types

```ts
// shared/messages.ts - stats slice

type StatsRequest =
  | { kind: 'stats.today' }
  | { kind: 'stats.week' }
  | { kind: 'stats.range'; days: 7 | 30 | 90 | 365 }
  | { kind: 'stats.streak' }
  | { kind: 'stats.byProject'; days: 7 | 30 | 90 | 365 }
  | { kind: 'stats.summary'; days: 7 | 30 | 90 | 365 };

type TodayStats = {
  workPomodoros: number;
  distractions: number;
  focusMinutes: number;
  deltaVs30dAvg: number;        // signed integer; positive = above average
};

type WeekStats = {
  workPomodoros: number;
  distractions: number;
  deltaVsPriorWeek: number;     // signed integer
  deltaPctVsPriorWeek: number;  // signed percentage, e.g. 50 = +50%
};

type StreakStats = {
  currentDays: number;          // consecutive days ending on the most recent active day
  longestDays: number;          // all-time longest run
  active: boolean;              // true if today already has >= 1 completed work pomodoro
};

type RangePoint = { day: string; pomodoros: number; distractions: number };
type RangeStats = {
  range: 7 | 30 | 90 | 365;
  points: RangePoint[];         // exactly `range` entries, oldest first, today last
  total: number;
};

type ProjectBreakdownItem = {
  projectId: string;
  projectName: string;
  projectColor: ProjectColor;
  count: number;
  percent: number;              // 0..100, 2 decimal precision
};
type ProjectBreakdown = {
  range: 7 | 30 | 90 | 365;
  items: ProjectBreakdownItem[]; // sorted descending by count
  total: number;
};

type StatsSummary = {
  today: TodayStats;
  week: WeekStats;
  streak: StreakStats;
  range: RangeStats;
  byProject: ProjectBreakdown;
};
```

## Filtering rules

Only pomodoros matching all of the following contribute to productivity counts (completed work pomodoro):

- `kind === 'work'`
- `completedFully === true`

Cancelled work pomodoros (`kind === 'work'`, `completedFully === false`) are excluded from all productivity counts. They still exist in the DB and their associated distractions are valid records, but they do not increment any stat.

Break pomodoros (`kind === 'short_break'` or `kind === 'long_break'`) are ignored entirely by the stats service.

## Date helpers

All ranges are inclusive of today. A `range=7` query covers today and the 6 prior calendar days (7 days total). All day strings use local timezone via `dayKey` from `shared/time.ts`.

```ts
// shared/time.ts (already defined in 01-data-model, repeated here for clarity)
function dayKey(at: number): string  // returns 'YYYY-MM-DD' in local time

function rangeKeys(days: number): { fromDay: string; toDay: string; keys: string[] } {
  // keys.length === days, keys[0] is oldest, keys[keys.length-1] is today
}
```

## Service API

```ts
// src/background/services/stats.ts
class StatsService {
  async today(): Promise<TodayStats>;
  async week(): Promise<WeekStats>;
  async range(days: 7 | 30 | 90 | 365): Promise<RangeStats>;
  async streak(): Promise<StreakStats>;
  async byProject(days: 7 | 30 | 90 | 365): Promise<ProjectBreakdown>;
  async summary(days: 7 | 30 | 90 | 365): Promise<StatsSummary>;
}
```

Each method performs one or two range scans on the `by_started` index on `pomodoros` (via `DB.listPomodorosForRange`), then aggregates in memory. No writes, no cross-request state.

## Computation details

### today()

1. Fetch all pomodoros for today's `dayKey`.
2. Filter to completed work pomodoros. `workPomodoros = count`.
3. Sum `plannedDurationMs` for completed work pomodoros. `focusMinutes = sum / 60_000`.
4. Count all distractions associated with today's pomodoros via `pomodoroId` lookup.
5. Compute `deltaVs30dAvg`:
   - Fetch completed work pomodoros over the prior 30 days (excluding today).
   - `avg30d = totalInPrior30 / 30` (float, days with 0 count as 0).
   - `deltaVs30dAvg = workPomodoros - Math.round(avg30d)`.

### week()

1. Fetch completed work pomodoros for the current week (today + prior 6 days).
2. `workPomodoros = count`.
3. Count distractions for all fetched pomodoros.
4. Fetch completed work pomodoros for the prior week (7 days before the current window).
5. `priorCount = count of prior week`.
6. `deltaVsPriorWeek = workPomodoros - priorCount`.
7. `deltaPctVsPriorWeek = priorCount === 0 ? 0 : Math.round((deltaVsPriorWeek / priorCount) * 100)`.

### range(days)

1. Build the full array of `days` day keys from oldest to today.
2. Fetch all pomodoros in the range via a single `listPomodorosForRange` call.
3. Group completed work pomodoros by `dayKey`. Group distractions by the `dayKey` of the parent pomodoro's `startedAt`.
4. For each key in the day array, emit a `RangePoint`:
   - `day`: the key string.
   - `pomodoros`: count from the group, or `0` if no data.
   - `distractions`: distraction count for that day's pomodoros, or `0`.
5. Points with zero pomodoros are always included so the UI receives a complete, gap-free array.
6. `total = sum of all pomodoro counts`.

### streak()

Walk backwards day by day starting from today.

```
currentDays = 0
day = today

loop:
  count = completed work pomodoros on `day`
  if count >= 1:
    currentDays++
    day = day - 1
  else if day === today:
    // today has 0 but the streak may still be alive from yesterday
    // do NOT break; step back one more day and start counting from there
    day = day - 1
    continue
  else:
    break
```

This rule means: if a user completed pomodoros yesterday but has not yet started today, `currentDays` reflects yesterday's run and the streak is still considered alive. It resets only if the day before today also has 0 completed pomodoros.

`active = todayCount > 0`.

`longestDays`: scan all days from the earliest recorded pomodoro's `dayKey` to today. Walk forward, tracking run length and the maximum seen. This is O(n) over distinct days, acceptable for up to ~10,000 pomodoros.

### byProject(days)

1. Fetch completed work pomodoros for the range.
2. Group by `projectId`, count per group.
3. Fetch all projects (including archived) from the projects store. Build a `Map<string, Project>`.
4. For each `projectId` in the grouped counts:
   - If found in the map: use `project.name` and `project.color`.
   - If not found (project was deleted, which is impossible in MVP but guarded anyway): use `projectName: '(deleted project)'` and `projectColor: 'red'`. Never throw.
5. `total = sum of all counts`. If `total === 0`, return `items: []`.
6. For each item: `percent = parseFloat(((count / total) * 100).toFixed(2))`.
7. Sort `items` descending by `count`.

## Heatmap level mapping

The UI (not this service) maps `RangePoint.pomodoros` to one of 5 display levels:

| Count | Level |
|---|---|
| 0 | 0 (empty cell) |
| 1-2 | 1 |
| 3-4 | 2 |
| 5-6 | 3 |
| 7+ | 4 |

The service returns raw counts. The mapping lives in the dashboard UI component.

## Performance

Single range scan on `by_started` index per request, then in-memory aggregation.

| Range | Estimated max rows |
|---|---|
| 7 days | ~70 pomodoros |
| 30 days | ~300 pomodoros |
| 90 days | ~900 pomodoros |
| 365 days | ~3,650 pomodoros |

All cases are trivial for in-memory JavaScript. No pagination, no cursors, no caching.

`summary(days)` executes all five computations and may issue up to four range scans (today window, prior 30d window, current week, prior week, and the main range). Still well under 10,000 rows total in normal usage.

## Messages handled

The background router handles all `StatsRequest` kinds and delegates to `StatsService`:

```ts
| { kind: 'stats.today' }                             -> TodayStats
| { kind: 'stats.week' }                              -> WeekStats
| { kind: 'stats.range'; days: 7|30|90|365 }          -> RangeStats
| { kind: 'stats.streak' }                            -> StreakStats
| { kind: 'stats.byProject'; days: 7|30|90|365 }      -> ProjectBreakdown
| { kind: 'stats.summary'; days: 7|30|90|365 }        -> StatsSummary
```

No mutations. All handlers are read-only and safe to call from any UI surface.

## Acceptance

- `stats.today` against an empty DB returns `{ workPomodoros: 0, distractions: 0, focusMinutes: 0, deltaVs30dAvg: 0 }`.
- `stats.range{ days: 7 }` returns exactly 7 `RangePoint` entries, oldest first, today last, with 0-valued entries for days with no data.
- Inserting completed work pomodoros on 5 consecutive days (days -4 through today) and one gap on day -5 returns `streak.currentDays = 5`.
- A user with no pomodoros today but pomodoros on the prior 3 days returns `streak.active = false` and `streak.currentDays = 3`.
- Project breakdown percentages sum to 100.00 (within 0.01 tolerance) when `total > 0`.
- A pomodoro referencing a deleted project ID appears in breakdown with `projectName: '(deleted project)'` and never throws.
- Cancelled work pomodoros (`completedFully: false`) are excluded from all counts.
- Break pomodoros are excluded from all counts.
- `deltaPctVsPriorWeek` returns `0` when prior week count is 0 (no division by zero).
- Vitest tests cover all computation functions against fixture data representing typical, empty, and edge-case histories.

## Out of scope

- Hourly or sub-day heatmap.
- Productivity score or AI-generated insights.
- Custom date ranges (only 7 / 30 / 90 / 365 in MVP).
- Exporting stats as CSV.
- Week-over-week trend beyond the single delta in `WeekStats`.
- Server-side or cross-device aggregation.
- Caching or memoization of computed results.

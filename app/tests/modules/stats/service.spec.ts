import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { dayKey, rangeKeys } from '@/shared/time';
import type { Pomodoro } from '@/modules/pomodoro/domain/types';
import type { Project } from '@/modules/project/domain/types';
import {
  computeTodayStats,
  computeWeekStats,
  computeRangeStats,
  computeStreakStats,
  computeProjectBreakdown,
} from '@/modules/stats/application/service';
import { createStatsService } from '@/modules/stats/application/service';

function makePomodoro(overrides: Partial<Pomodoro> = {}): Pomodoro {
  return {
    id: 'p1',
    taskId: 'task-1',
    projectId: 'proj-1',
    kind: 'work',
    startedAt: Date.now(),
    endedAt: Date.now() + 25 * 60 * 1000,
    plannedDurationMs: 25 * 60 * 1000,
    completedFully: true,
    distractionCount: 0,
    cycleIndex: 1,
    dayKey: dayKey(Date.now()),
    ...overrides,
  };
}

function dayAgo(n: number): string {
  return dayKey(Date.now() - n * 86400 * 1000);
}

// --- computeTodayStats ---

describe('computeTodayStats', () => {
  it('returns zeros for empty data', () => {
    const result = computeTodayStats([], 0, 0);
    expect(result).toEqual({ workPomodoros: 0, distractions: 0, focusMinutes: 0, deltaVs30dAvg: 0 });
  });

  it('computes normal day', () => {
    const pomodoros = [
      makePomodoro({ plannedDurationMs: 25 * 60 * 1000 }),
      makePomodoro({ plannedDurationMs: 25 * 60 * 1000 }),
    ];
    // 30-day avg = 3 per day → delta = 2 - 3 = -1
    const result = computeTodayStats(pomodoros, 5, 90);
    expect(result.workPomodoros).toBe(2);
    expect(result.distractions).toBe(5);
    expect(result.focusMinutes).toBe(50);
    expect(result.deltaVs30dAvg).toBe(-1);
  });

  it('handles zero prior work count', () => {
    const pomodoros = [makePomodoro()];
    const result = computeTodayStats(pomodoros, 0, 0);
    expect(result.workPomodoros).toBe(1);
    expect(result.deltaVs30dAvg).toBe(1);
  });

  it('rounds focus minutes', () => {
    // 25 min + 24 min 30 sec = 49.5 min → rounds to 50
    const pomodoros = [
      makePomodoro({ plannedDurationMs: 25 * 60 * 1000 }),
      makePomodoro({ plannedDurationMs: 24 * 60 * 1000 + 30 * 1000 }),
    ];
    const result = computeTodayStats(pomodoros, 0, 0);
    expect(result.focusMinutes).toBe(50);
  });
});

// --- computeWeekStats ---

describe('computeWeekStats', () => {
  it('returns zeros for empty weeks', () => {
    const result = computeWeekStats([], []);
    expect(result).toEqual({ workPomodoros: 0, distractions: 0, deltaVsPriorWeek: 0, deltaPctVsPriorWeek: 0 });
  });

  it('computes normal week vs prior', () => {
    const current = [
      makePomodoro({ id: 'c1', distractionCount: 2 }),
      makePomodoro({ id: 'c2', distractionCount: 1 }),
    ];
    const prior = [makePomodoro({ id: 'p1' })];

    const result = computeWeekStats(current, prior);
    expect(result.workPomodoros).toBe(2);
    expect(result.distractions).toBe(3);
    expect(result.deltaVsPriorWeek).toBe(1);
    expect(result.deltaPctVsPriorWeek).toBe(100); // (2-1)/1 * 100 = 100
  });

  it('handles zero prior week without division by zero', () => {
    const current = [makePomodoro({ id: 'c1' })];
    const result = computeWeekStats(current, []);
    expect(result.deltaPctVsPriorWeek).toBe(0);
  });

  it('handles negative delta', () => {
    const current: Pomodoro[] = [];
    const prior = [
      makePomodoro({ id: 'p1' }),
      makePomodoro({ id: 'p2' }),
    ];
    const result = computeWeekStats(current, prior);
    expect(result.workPomodoros).toBe(0);
    expect(result.deltaVsPriorWeek).toBe(-2);
    expect(result.deltaPctVsPriorWeek).toBe(-100);
  });
});

// --- computeRangeStats ---

describe('computeRangeStats', () => {
  it('returns gap-free zeros for empty data', () => {
    const keys = rangeKeys(7);
    const result = computeRangeStats(new Map(), new Map(), keys, 7);
    expect(result.points).toHaveLength(7);
    expect(result.points.every(p => p.pomodoros === 0 && p.distractions === 0)).toBe(true);
    expect(result.total).toBe(0);
  });

  it('returns correct points with data', () => {
    const keys = rangeKeys(7);
    const pomCounts = new Map([[keys[0], 3], [keys[2], 1], [keys[6], 2]]);
    const distCounts = new Map([[keys[0], 5], [keys[2], 0], [keys[6], 1]]);

    const result = computeRangeStats(pomCounts, distCounts, keys, 7);
    expect(result.points).toHaveLength(7);
    expect(result.points[0]).toEqual({ day: keys[0], pomodoros: 3, distractions: 5 });
    expect(result.points[1]).toEqual({ day: keys[1], pomodoros: 0, distractions: 0 });
    expect(result.points[6]).toEqual({ day: keys[6], pomodoros: 2, distractions: 1 });
    expect(result.total).toBe(6);
  });
});

// --- computeStreakStats ---

describe('computeStreakStats', () => {
  it('returns zeros for empty data', () => {
    const result = computeStreakStats(new Map(), dayKey(Date.now()));
    expect(result).toEqual({ currentDays: 0, longestDays: 0, active: false });
  });

  it('5 consecutive days ending today', () => {
    const today = dayKey(Date.now());
    const counts = new Map([
      [today, 3],
      [dayAgo(1), 1],
      [dayAgo(2), 2],
      [dayAgo(3), 1],
      [dayAgo(4), 1],
    ]);
    const result = computeStreakStats(counts, today);
    expect(result.currentDays).toBe(5);
    expect(result.active).toBe(true);
    expect(result.longestDays).toBe(5);
  });

  it('no pomodoros today but had yesterday', () => {
    const today = dayKey(Date.now());
    // yesterday and day before have data, today does not
    const counts = new Map([
      [dayAgo(1), 2],
      [dayAgo(2), 1],
    ]);
    const result = computeStreakStats(counts, today);
    // Skip today (0), count from yesterday: 2 days (yesterday + day before)
    expect(result.currentDays).toBe(2);
    expect(result.active).toBe(false);
  });

  it('today only', () => {
    const today = dayKey(Date.now());
    const counts = new Map([[today, 1]]);
    const result = computeStreakStats(counts, today);
    expect(result.currentDays).toBe(1);
    expect(result.active).toBe(true);
    expect(result.longestDays).toBe(1);
  });

  it('gap breaks streak', () => {
    // today has data, yesterday does not, day before does → streak = 1 (today only)
    const today = dayKey(Date.now());
    const counts = new Map([
      [today, 1],
      [dayAgo(2), 1],
    ]);
    const result = computeStreakStats(counts, today);
    expect(result.currentDays).toBe(1);
    expect(result.active).toBe(true);
  });

  it('longest streak tracks longest run with gaps', () => {
    const today = dayKey(Date.now());
    // 3 consecutive days, then gap, then 2 consecutive
    const counts = new Map([
      [dayAgo(0), 1],  // today
      [dayAgo(1), 1],
      [dayAgo(2), 1],
      // dayAgo(3) missing = gap
      [dayAgo(4), 1],
      [dayAgo(5), 1],
      // dayAgo(6) missing
    ]);
    const result = computeStreakStats(counts, today);
    // Current streak from today: today(1) → dayAgo1(1) → dayAgo2(1) → dayAgo3(0) → break = 3
    expect(result.currentDays).toBe(3);
    // Longest: both runs are 3
    expect(result.longestDays).toBe(3);
    expect(result.active).toBe(true);
  });

  it('longest with larger gap', () => {
    const today = dayKey(Date.now());
    // 5 consecutive, then gap, then 2 consecutive
    const map = new Map<string, number>();
    for (let i = 0; i < 5; i++) {
      map.set(dayAgo(i), 1);
    }
    // dayAgo(5) missing
    map.set(dayAgo(6), 1);
    map.set(dayAgo(7), 1);

    const result = computeStreakStats(map, today);
    expect(result.currentDays).toBe(5);
    expect(result.longestDays).toBe(5);
  });
});

// --- computeProjectBreakdown ---

describe('computeProjectBreakdown', () => {
  const projects: Project[] = [
    { id: 'proj-a', name: 'Alpha', color: 'blue', archived: false, createdAt: 0 },
    { id: 'proj-b', name: 'Beta', color: 'green', archived: false, createdAt: 0 },
  ];

  it('returns empty for zero total', () => {
    const result = computeProjectBreakdown(new Map(), [], 30);
    expect(result.items).toHaveLength(0);
    expect(result.total).toBe(0);
  });

  it('computes percentages correctly', () => {
    const counts = new Map([['proj-a', 3], ['proj-b', 1]]);
    const result = computeProjectBreakdown(counts, projects, 30);
    expect(result.items).toHaveLength(2);
    expect(result.total).toBe(4);
    expect(result.items[0].projectName).toBe('Alpha');
    expect(result.items[0].count).toBe(3);
    expect(result.items[0].percent).toBe(75);
    expect(result.items[1].projectName).toBe('Beta');
    expect(result.items[1].count).toBe(1);
    expect(result.items[1].percent).toBe(25);
  });

  it('percentages sum to 100', () => {
    const counts = new Map([['proj-a', 7], ['proj-b', 3]]);
    const result = computeProjectBreakdown(counts, projects, 30);
    const sum = result.items.reduce((s, i) => s + i.percent, 0);
    expect(sum).toBe(100);
  });

  it('handles deleted project', () => {
    const counts = new Map([['deleted-proj', 2]]);
    const result = computeProjectBreakdown(counts, projects, 30);
    expect(result.items[0].projectName).toBe('(deleted project)');
    expect(result.items[0].projectColor).toBe('red');
    expect(result.total).toBe(2);
  });

  it('sorts descending by count', () => {
    const counts = new Map([['proj-b', 5], ['proj-a', 10]]);
    const result = computeProjectBreakdown(counts, projects, 30);
    expect(result.items[0].projectId).toBe('proj-a'); // 10 > 5
    expect(result.items[1].projectId).toBe('proj-b');
  });
});

// --- Integration: StatsService with DB ---

describe('StatsService', () => {
  it('today() returns zeros for fresh DB', async () => {
    const db = await createFreshDB();
    const svc = createStatsService(db);
    const result = await svc.today();
    expect(result).toEqual({ workPomodoros: 0, distractions: 0, focusMinutes: 0, deltaVs30dAvg: 0 });
  });

  it('streak() returns zeros for fresh DB', async () => {
    const db = await createFreshDB();
    const svc = createStatsService(db);
    const result = await svc.streak();
    expect(result).toEqual({ currentDays: 0, longestDays: 0, active: false });
  });

  it('summary() returns all properties for fresh DB', async () => {
    const db = await createFreshDB();
    const svc = createStatsService(db);
    const result = await svc.summary(30);
    expect(result.today.workPomodoros).toBe(0);
    expect(result.week.workPomodoros).toBe(0);
    expect(result.streak.currentDays).toBe(0);
    expect(result.range.total).toBe(0);
    expect(result.byProject.total).toBe(0);
  });
});

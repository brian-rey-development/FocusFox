import type { DB } from '@/shared/database/types';
import { dayKey, rangeKeys, offsetDayKey } from '@/shared/time';
import type { Pomodoro } from '@/modules/pomodoro/domain/types';
import type { Project } from '@/modules/project/domain/types';
import type {
  TodayStats,
  WeekStats,
  RangeStats,
  RangePoint,
  StreakStats,
  ProjectBreakdown,
  ProjectBreakdownItem,
  StatsSummary,
  RangeDays,
} from '../domain/types';

// --- Pure computation functions (testable without DB) ---

export function computeTodayStats(
  workPomodoros: Pomodoro[],
  distractionsCount: number,
  prior30dWorkCount: number,
): TodayStats {
  const workCount = workPomodoros.length;
  const focusMinutes = Math.round(workPomodoros.reduce((sum, p) => sum + p.plannedDurationMs, 0) / 60_000);
  const avg30d = prior30dWorkCount / 30;
  const deltaVs30dAvg = workCount - Math.round(avg30d);

  return {
    workPomodoros: workCount,
    distractions: distractionsCount,
    focusMinutes,
    deltaVs30dAvg,
  };
}

export function computeWeekStats(
  currentWeek: Pomodoro[],
  priorWeek: Pomodoro[],
): WeekStats {
  const workPomodoros = currentWeek.length;
  const priorCount = priorWeek.length;

  let distractions = 0;
  for (const p of currentWeek) {
    distractions += p.distractionCount;
  }

  const deltaVsPriorWeek = workPomodoros - priorCount;
  const deltaPctVsPriorWeek = priorCount === 0 ? 0 : Math.round((deltaVsPriorWeek / priorCount) * 100);

  return { workPomodoros, distractions, deltaVsPriorWeek, deltaPctVsPriorWeek };
}

export function computeRangeStats(
  pomodoroCounts: Map<string, number>,
  distractionCounts: Map<string, number>,
  dayKeys: string[],
  range: RangeDays,
): RangeStats {
  const points: RangePoint[] = dayKeys.map(day => ({
    day,
    pomodoros: pomodoroCounts.get(day) ?? 0,
    distractions: distractionCounts.get(day) ?? 0,
  }));

  const total = points.reduce((sum, p) => sum + p.pomodoros, 0);

  return { range, points, total };
}

export function computeStreakStats(
  dayPomodoroCounts: Map<string, number>,
  today: string,
): StreakStats {
  if (dayPomodoroCounts.size === 0) {
    return { currentDays: 0, longestDays: 0, active: false };
  }

  const todayCount = dayPomodoroCounts.get(today) ?? 0;
  const active = todayCount > 0;

  // Current streak: walk backwards from today
  let currentDays = 0;
  let day = today;

  while (true) {
    const count = dayPomodoroCounts.get(day) ?? 0;
    if (count >= 1) {
      currentDays++;
      day = offsetDayKey(day, -1);
    } else if (day === today) {
      // Today has 0 but streak may still be alive from yesterday
      day = offsetDayKey(day, -1);
      continue;
    } else {
      break;
    }
  }

  // Longest streak: scan all days from earliest to today
  let longestDays = 0;
  let currentRun = 0;

  const sortedDays = [...dayPomodoroCounts.keys()].sort();
  let cursor = sortedDays[0];

  while (cursor <= today) {
    if (dayPomodoroCounts.has(cursor)) {
      currentRun++;
      longestDays = Math.max(longestDays, currentRun);
    } else {
      currentRun = 0;
    }
    cursor = offsetDayKey(cursor, 1);
  }

  return { currentDays, longestDays, active };
}

export function computeProjectBreakdown(
  pomodoroProjectCounts: Map<string, number>,
  projects: Project[],
  days: RangeDays,
): ProjectBreakdown {
  const total = [...pomodoroProjectCounts.values()].reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return { range: days, items: [], total: 0 };
  }

  const projectMap = new Map(projects.map(p => [p.id, p]));

  const items: ProjectBreakdownItem[] = [...pomodoroProjectCounts.entries()]
    .map(([projectId, count]) => {
      const project = projectMap.get(projectId);
      return {
        projectId,
        projectName: project ? project.name : '(deleted project)',
        projectColor: project ? project.color : 'red',
        count,
        percent: parseFloat(((count / total) * 100).toFixed(2)),
      };
    })
    .sort((a, b) => b.count - a.count);

  return { range: days, items, total };
}

export function computeStatsSummary(
  today: TodayStats,
  week: WeekStats,
  streak: StreakStats,
  range: RangeStats,
  byProject: ProjectBreakdown,
): StatsSummary {
  return { today, week, streak, range, byProject };
}

// --- Service ---

export interface StatsService {
  today(): Promise<TodayStats>;
  week(): Promise<WeekStats>;
  range(days: RangeDays): Promise<RangeStats>;
  streak(): Promise<StreakStats>;
  byProject(days: RangeDays): Promise<ProjectBreakdown>;
  summary(days: RangeDays): Promise<StatsSummary>;
}

function filterCompletedWork(pomodoros: Pomodoro[]): Pomodoro[] {
  return pomodoros.filter(p => p.kind === 'work' && p.completedFully);
}

export function createStatsService(db: DB): StatsService {
  return {
    async today() {
      const todayKey = dayKey(Date.now());
      const allToday = await db.pomodoros.listForRange(todayKey, todayKey);
      const workPomodoros = filterCompletedWork(allToday);

      const distractionsCount = workPomodoros.reduce((sum, p) => sum + p.distractionCount, 0);

      const priorFromKey = dayKey(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const priorToKey = dayKey(Date.now() - 24 * 60 * 60 * 1000);
      const priorAll = await db.pomodoros.listForRange(priorFromKey, priorToKey);
      const priorWork = filterCompletedWork(priorAll);

      return computeTodayStats(workPomodoros, distractionsCount, priorWork.length);
    },

    async week() {
      const keys = rangeKeys(7);
      const priorFrom = offsetDayKey(keys[0], -7);
      const priorTo = offsetDayKey(keys[0], -1);
      const [currentAll, priorAll] = await Promise.all([
        db.pomodoros.listForRange(keys[0], keys[6]),
        db.pomodoros.listForRange(priorFrom, priorTo),
      ]);

      return computeWeekStats(
        filterCompletedWork(currentAll),
        filterCompletedWork(priorAll),
      );
    },

    async range(days) {
      const keys = rangeKeys(days);
      const all = await db.pomodoros.listForRange(keys[0], keys[keys.length - 1]);
      const workPomodoros = filterCompletedWork(all);

      const pomCounts = new Map<string, number>();
      const distCounts = new Map<string, number>();
      for (const p of workPomodoros) {
        pomCounts.set(p.dayKey, (pomCounts.get(p.dayKey) ?? 0) + 1);
        distCounts.set(p.dayKey, (distCounts.get(p.dayKey) ?? 0) + p.distractionCount);
      }

      return computeRangeStats(pomCounts, distCounts, keys, days);
    },

    async streak() {
      const todayKey = dayKey(Date.now());
      const allPomodoros = await db.pomodoros.listForRange('2000-01-01', todayKey);
      const workPomodoros = filterCompletedWork(allPomodoros);

      const dayCounts = new Map<string, number>();
      for (const p of workPomodoros) {
        dayCounts.set(p.dayKey, (dayCounts.get(p.dayKey) ?? 0) + 1);
      }

      return computeStreakStats(dayCounts, todayKey);
    },

    async byProject(days) {
      const keys = rangeKeys(days);
      const all = await db.pomodoros.listForRange(keys[0], keys[keys.length - 1]);
      const workPomodoros = filterCompletedWork(all);

      const projectCounts = new Map<string, number>();
      for (const p of workPomodoros) {
        projectCounts.set(p.projectId, (projectCounts.get(p.projectId) ?? 0) + 1);
      }

      const projects = await db.projects.list();

      return computeProjectBreakdown(projectCounts, projects, days);
    },

    async summary(days) {
      const [todayResult, weekResult, streakResult, rangeResult, byProjectResult] = await Promise.all([
        this.today(),
        this.week(),
        this.streak(),
        this.range(days),
        this.byProject(days),
      ]);

      return computeStatsSummary(todayResult, weekResult, streakResult, rangeResult, byProjectResult);
    },
  };
}

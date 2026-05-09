import { z } from 'zod';

export const RANGE_DAYS = [7, 30, 90, 365] as const;
export type RangeDays = (typeof RANGE_DAYS)[number];

export const RangeDaysSchema = z.union([
  z.literal(7),
  z.literal(30),
  z.literal(90),
  z.literal(365),
]);

export interface TodayStats {
  workPomodoros: number;
  distractions: number;
  focusMinutes: number;
  deltaVs30dAvg: number;
}

export interface WeekStats {
  workPomodoros: number;
  distractions: number;
  deltaVsPriorWeek: number;
  deltaPctVsPriorWeek: number;
}

export interface StreakStats {
  currentDays: number;
  longestDays: number;
  active: boolean;
}

export interface RangePoint {
  day: string;
  pomodoros: number;
  distractions: number;
}

export interface RangeStats {
  range: RangeDays;
  points: RangePoint[];
  total: number;
}

export interface ProjectBreakdownItem {
  projectId: string;
  projectName: string;
  projectColor: string;
  count: number;
  percent: number;
}

export interface ProjectBreakdown {
  range: RangeDays;
  items: ProjectBreakdownItem[];
  total: number;
}

export interface StatsSummary {
  today: TodayStats;
  week: WeekStats;
  streak: StreakStats;
  range: RangeStats;
  byProject: ProjectBreakdown;
}

import { z } from 'zod';

export const PomodoroKindSchema = z.enum(['work', 'short_break', 'long_break']);
export type PomodoroKind = z.infer<typeof PomodoroKindSchema>;

export const PomodoroSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  projectId: z.string(),
  kind: PomodoroKindSchema,
  startedAt: z.number(),
  endedAt: z.number().nullable(),
  plannedDurationMs: z.number().int().positive(),
  completedFully: z.boolean(),
  distractionCount: z.number().int().nonnegative(),
  cycleIndex: z.number().int().nonnegative(),
  dayKey: z.string(),
});

export type Pomodoro = z.infer<typeof PomodoroSchema>;

export const StartPomodoroSchema = z.object({
  taskId: z.string(),
  projectId: z.string(),
  kind: PomodoroKindSchema,
  plannedDurationMs: z.number().int().positive(),
  cycleIndex: z.number().int().nonnegative(),
});

export type StartPomodoroInput = z.infer<typeof StartPomodoroSchema>;

export const TodayStatsSchema = z.object({
  workCount: z.number().int().nonnegative(),
  totalWorkMs: z.number().int().nonnegative(),
  totalDistractions: z.number().int().nonnegative(),
});

export type TodayStats = z.infer<typeof TodayStatsSchema>;

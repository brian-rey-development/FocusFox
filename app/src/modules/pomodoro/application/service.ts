import type { DB } from '@/shared/database/types';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { dayKey } from '@/shared/time';
import { StartPomodoroSchema } from '../domain/types';
import type { Pomodoro, TodayStats } from '../domain/types';
import type { TaskService } from '@/modules/task/application/service';

export interface PomodoroService {
  start(input: unknown): Promise<Pomodoro>;
  finish(id: string, completedFully?: boolean, distractionCount?: number): Promise<Pomodoro>;
  getActive(): Promise<Pomodoro | null>;
  getTodayStats(): Promise<TodayStats>;
}

export function createPomodoroService(
  db: DB,
  taskSvc: TaskService,
): PomodoroService {
  return {
    async start(input) {
      const parsed = StartPomodoroSchema.parse(input);
      const existing = await this.getActive();
      if (existing) {
        throw new ConflictError('A pomodoro is already active');
      }
      const pomodoro = await db.pomodoros.start(parsed);
      return pomodoro;
    },

    async finish(id, completedFully = true, distractionCount) {
      const pomodoro = await db.pomodoros.get(id);
      if (!pomodoro) {
        throw new NotFoundError('Pomodoro', id);
      }
      if (pomodoro.endedAt !== null) {
        throw new ValidationError('Pomodoro is already finished');
      }
      const updated = await db.pomodoros.finish(id, Date.now(), completedFully, distractionCount);
      if (completedFully && pomodoro.kind === 'work') {
        await taskSvc.incrementCompletedPomodoros(pomodoro.taskId);
      }
      return updated;
    },

    async getActive() {
      const now = Date.now();
      const today = dayKey(now);
      const yesterdayMs = now - 86_400_000;
      const yesterday = dayKey(yesterdayMs);
      const days = yesterday === today
        ? [today]
        : [yesterday, today];
      const both = await Promise.all(days.map((d) => db.pomodoros.listForDay(d)));
      const all = both.flat();
      const candidate = all.find((p) => p.endedAt === null) ?? null;

      if (candidate === null) return null;

      const GRACE_MS = 60_000;
      const staleAt = candidate.startedAt + candidate.plannedDurationMs + GRACE_MS;
      if (now >= staleAt) {
        await db.pomodoros.finish(
          candidate.id,
          candidate.startedAt + candidate.plannedDurationMs,
          false,
          candidate.distractionCount,
        );
        return null;
      }

      return candidate;
    },

    async getTodayStats() {
      const today = dayKey(Date.now());
      const pomodoros = await db.pomodoros.listForDay(today);
      const workPomodoros = pomodoros.filter((p) => p.kind === 'work');
      const stats: TodayStats = {
        workCount: workPomodoros.length,
        totalWorkMs: workPomodoros
          .filter((p) => p.completedFully)
          .reduce((sum, p) => sum + p.plannedDurationMs, 0),
        totalDistractions: workPomodoros.reduce((sum, p) => sum + p.distractionCount, 0),
      };
      return stats;
    },
  };
}

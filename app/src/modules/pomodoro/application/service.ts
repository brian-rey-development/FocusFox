import type { DB } from '@/shared/database/types';
import { ConflictError, NotFoundError, ValidationError } from '@/shared/errors';
import { dayKey } from '@/shared/time';
import { StartPomodoroSchema } from '../domain/types';
import type { Pomodoro, TodayStats } from '../domain/types';
import type { TaskService } from '@/modules/task/application/service';
import type { NoteService } from '@/modules/note/application/service';

export interface PomodoroService {
  start(input: unknown): Promise<Pomodoro>;
  finish(id: string, completedFully?: boolean): Promise<Pomodoro>;
  getActive(): Promise<Pomodoro | null>;
  getTodayStats(): Promise<TodayStats>;
}

export function createPomodoroService(
  db: DB,
  taskSvc: TaskService,
  noteSvc: NoteService,
): PomodoroService {
  return {
    async start(input) {
      const parsed = StartPomodoroSchema.parse(input);
      const existing = await this.getActive();
      if (existing) {
        throw new ConflictError('A pomodoro is already active');
      }
      const pomodoro = await db.pomodoros.start(parsed);
      const today = dayKey(pomodoro.startedAt);
      await noteSvc.add({
        day: today,
        kind: 'auto',
        text: `Started pomodoro for task ${parsed.taskId}`,
      });
      return pomodoro;
    },

    async finish(id, completedFully = true) {
      const pomodoro = await db.pomodoros.get(id);
      if (!pomodoro) {
        throw new NotFoundError('Pomodoro', id);
      }
      if (pomodoro.endedAt !== null) {
        throw new ValidationError('Pomodoro is already finished');
      }
      const updated = await db.pomodoros.finish(id, Date.now(), completedFully);
      if (completedFully && pomodoro.kind === 'work') {
        await taskSvc.incrementCompletedPomodoros(pomodoro.taskId);
      }
      return updated;
    },

    async getActive() {
      const today = dayKey(Date.now());
      const yesterdayMs = Date.now() - 86_400_000;
      const yesterday = dayKey(yesterdayMs);
      const days = yesterday === today
        ? [today]
        : [yesterday, today];
      const both = await Promise.all(days.map((d) => db.pomodoros.listForDay(d)));
      const all = both.flat();
      return all.find((p) => p.endedAt === null) ?? null;
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

import type { DB } from '@/shared/database/types';
import { ConflictError, NotFoundError } from '@/shared/errors';
import { dayKey } from '@/shared/time';
import { StartPomodoroSchema, TodayStatsSchema } from './domain/types';
import type { Pomodoro, TodayStats } from './domain/types';
import type { TaskService } from '@/modules/task/service';
import type { NoteService } from '@/modules/note/service';

export interface PomodoroService {
  start(input: unknown): Promise<Pomodoro>;
  finish(id: string): Promise<Pomodoro>;
  getActive(): Promise<Pomodoro | null>;
  getTodayStats(): Promise<TodayStats>;
}

export function createPomodoroService(
  db: DB,
  taskService: TaskService,
  noteService: NoteService,
): PomodoroService {
  return {
    async start(input) {
      const parsed = StartPomodoroSchema.parse(input);
      const today = dayKey(Date.now());
      const todaysPomodoros = await db.pomodoros.listForDay(today);
      const active = todaysPomodoros.find((p) => p.endedAt === null);

      if (active) {
        throw new ConflictError('An active pomodoro is already running');
      }

      await taskService.setStatus(parsed.taskId, 'doing');
      return db.pomodoros.start(parsed);
    },

    async finish(id) {
      const pomodoro = await db.pomodoros.get(id);

      if (!pomodoro) {
        throw new NotFoundError('Pomodoro', id);
      }

      if (pomodoro.endedAt !== null) {
        throw new ConflictError('Pomodoro is already finished');
      }

      const finished = await db.pomodoros.finish(id, Date.now(), true);

      if (pomodoro.kind === 'work') {
        await taskService.incrementCompletedPomodoros(pomodoro.taskId);
        await noteService.add({
          day: pomodoro.dayKey,
          kind: 'auto',
          text: 'Pomodoro completed',
          refType: 'pomodoro',
          refId: pomodoro.id,
        });
      }

      return finished;
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
      const work = pomodoros.filter((p) => p.kind === 'work');

      const stats: TodayStats = {
        workCount: work.filter((p) => p.completedFully).length,
        totalWorkMs: work
          .filter((p) => p.completedFully)
          .reduce((sum, p) => sum + p.plannedDurationMs, 0),
        totalDistractions: pomodoros.reduce((sum, p) => sum + p.distractionCount, 0),
      };

      return TodayStatsSchema.parse(stats);
    },
  };
}

import type { IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

import { NotFoundError } from '@/shared/errors';
import type { FocusFoxDB } from '@/shared/database/types';
import type { PomodoroRepo } from '../domain/interfaces';
import type { Pomodoro } from '../domain/types';
import { dayKey } from '@/shared/time';

export function createPomodoroRepo(db: IDBPDatabase<FocusFoxDB>): PomodoroRepo {
  return {
    async start(input) {
      const now = Date.now();
      const pomodoro: Pomodoro = {
        id: ulid(),
        taskId: input.taskId,
        projectId: input.projectId,
        kind: input.kind,
        startedAt: now,
        endedAt: null,
        plannedDurationMs: input.plannedDurationMs,
        completedFully: false,
        distractionCount: 0,
        cycleIndex: input.cycleIndex,
        dayKey: dayKey(now),
      };

      await db.add('pomodoros', pomodoro);
      return pomodoro;
    },

    async finish(id, endedAt, completedFully) {
      const tx = db.transaction('pomodoros', 'readwrite');
      const store = tx.store;
      const existing = await store.get(id);

      if (!existing) {
        throw new NotFoundError('Pomodoro', id);
      }

      const updated: Pomodoro = {
        ...existing,
        endedAt,
        completedFully,
      };

      await store.put(updated);
      await tx.done;
      return updated;
    },

    async get(id) {
      const p = await db.get('pomodoros', id);
      return p ?? null;
    },

    async listForDay(day) {
      const tx = db.transaction('pomodoros', 'readonly');
      const index = tx.store.index('by_day');
      return index.getAll(day);
    },

    async listForRange(fromDay, toDay) {
      const tx = db.transaction('pomodoros', 'readonly');
      const index = tx.store.index('by_day');
      return index.getAll(IDBKeyRange.bound(fromDay, toDay));
    },
  };
}

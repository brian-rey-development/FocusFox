import type { IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

import type { FocusFoxDB } from '@/shared/database/types';
import type { DistractionRepo } from '../domain/interfaces';
import type { Distraction } from '../domain/types';

export function createDistractionRepo(db: IDBPDatabase<FocusFoxDB>): DistractionRepo {
  return {
    async add(input) {
      const distraction: Distraction = {
        id: ulid(),
        pomodoroId: input.pomodoroId,
        type: input.type,
        url: input.url ?? null,
        domain: input.domain ?? null,
        reason: input.reason ?? null,
        at: Date.now(),
      };

      await db.add('distractions', distraction);
      return distraction;
    },

    async listForPomodoro(pomodoroId) {
      const tx = db.transaction('distractions', 'readonly');
      const index = tx.store.index('by_pomodoro');
      return index.getAll(pomodoroId);
    },

    async recentAutoForDomain(pomodoroId, domain, withinMs) {
      const tx = db.transaction('distractions', 'readonly');
      const index = tx.store.index('by_pomodoro');
      const all = await index.getAll(pomodoroId);
      const cutoff = Date.now() - withinMs;

      const match = all.find(
        (d) => d.type === 'auto_blocked_attempt' && d.domain === domain && d.at >= cutoff,
      );

      return match ?? null;
    },
  };
}

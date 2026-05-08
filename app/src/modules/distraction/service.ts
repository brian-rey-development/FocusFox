import type { DB } from '@/shared/database/types';
import { CreateDistractionSchema } from './domain/types';
import type { Distraction } from './domain/types';
import { DISTRACTION_DEDUPE_WINDOW_MS } from '@/shared/constants';

export interface DistractionService {
  record(input: unknown): Promise<Distraction>;
  listForPomodoro(pomodoroId: string): Promise<Distraction[]>;
}

export function createDistractionService(db: DB): DistractionService {
  return {
    async record(input) {
      const parsed = CreateDistractionSchema.parse(input);

      if (parsed.type === 'auto_blocked_attempt' && parsed.domain) {
        const match = await db.distractions.recentAutoForDomain(
          parsed.pomodoroId,
          parsed.domain,
          DISTRACTION_DEDUPE_WINDOW_MS,
        );
        if (match) return match;
      }

      return db.distractions.add(parsed);
    },

    async listForPomodoro(pomodoroId) {
      return db.distractions.listForPomodoro(pomodoroId);
    },
  };
}

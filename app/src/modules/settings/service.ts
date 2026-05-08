import type { DB } from '@/shared/database/types';
import type { Settings } from './domain/types';
import { UpdateSettingsSchema } from './domain/types';

export interface SettingsService {
  get(): Promise<Settings>;
  update(patch: unknown): Promise<Settings>;
}

export function createSettingsService(db: DB): SettingsService {
  return {
    get(): Promise<Settings> {
      return db.settings.get();
    },

    async update(patch: unknown): Promise<Settings> {
      const parsed = UpdateSettingsSchema.parse(patch);
      return db.settings.update(parsed);
    },
  };
}

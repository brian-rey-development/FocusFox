import type { IDBPDatabase } from 'idb';

import { NotFoundError } from '@/shared/errors';
import type { FocusFoxDB } from '@/shared/database/types';
import type { SettingsRepo } from '../domain/interfaces';
import type { Settings } from '../domain/types';

const SETTINGS_KEY = 'default' as const;

export function createSettingsRepo(db: IDBPDatabase<FocusFoxDB>): SettingsRepo {
  return {
    async get() {
      const settings = await db.get('settings', SETTINGS_KEY);

      if (!settings) {
        throw new NotFoundError('Settings', 'default');
      }

      return settings;
    },

    async update(patch) {
      const tx = db.transaction('settings', 'readwrite');
      const store = tx.store;
      const existing = await store.get(SETTINGS_KEY);

      if (!existing) {
        throw new NotFoundError('Settings', 'default');
      }

      const updated: Settings = { ...existing, ...patch };
      await store.put(updated);
      await tx.done;
      return updated;
    },
  };
}

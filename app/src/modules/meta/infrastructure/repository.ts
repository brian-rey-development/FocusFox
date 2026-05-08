import type { IDBPDatabase } from 'idb';

import type { MetaRow } from '../domain/types';
import type { FocusFoxDB } from '@/shared/database/types';
import type { MetaRepo } from '../domain/interfaces';

export function createMetaRepo(db: IDBPDatabase<FocusFoxDB>): MetaRepo {
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      const row = await db.get('meta', key);
      return row ? (row.value as T) : null;
    },

    async set(key, value) {
      await db.put('meta', { key, value } satisfies MetaRow);
    },
  };
}

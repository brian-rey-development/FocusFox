import type { DB } from '@/shared/database/types';

export interface MetaService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
}

export function createMetaService(db: DB): MetaService {
  return {
    get(key) {
      return db.meta.get(key);
    },

    set(key, value) {
      return db.meta.set(key, value);
    },
  };
}

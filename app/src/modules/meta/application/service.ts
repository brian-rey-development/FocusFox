import type { DB } from '@/shared/database/types';
import type { FooterMeta } from '../domain/types';

export interface MetaService {
  get<T = unknown>(key: string): Promise<T | null>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  getFooter(version: string): Promise<FooterMeta>;
}

export function createMetaService(db: DB): MetaService {
  return {
    async get<T = unknown>(key: string): Promise<T | null> {
      return db.meta.get<T>(key);
    },
    async set<T = unknown>(key: string, value: T): Promise<void> {
      return db.meta.set(key, value);
    },
    async getFooter(version: string): Promise<FooterMeta> {
      const [projectCount, taskCount, pomodoroCount, schemaVersion, lastExportAt] = await Promise.all([
        db.raw.count('projects'),
        db.raw.count('tasks'),
        db.raw.count('pomodoros'),
        db.meta.get<number>('schemaVersion'),
        db.meta.get<number>('lastExportAt'),
      ]);
      return {
        version,
        schemaVersion: schemaVersion ?? 1,
        counts: { projects: projectCount, tasks: taskCount, pomodoros: pomodoroCount },
        lastExportAt: lastExportAt ?? null,
      };
    },
  };
}

import type { DB } from '@/shared/database/types';
import type { ExportPayload } from '../domain/types';
import { ExportV1Schema } from '../domain/types';

export interface DataService {
  export(): Promise<ExportPayload>;
  import(payload: unknown): Promise<void>;
  reset(): Promise<void>;
}

export function createDataService(db: DB): DataService {
  const raw = db.raw;

  return {
    async export(): Promise<ExportPayload> {
      const [projects, tasks, pomodoros, distractions, notes, settings, metaRows] =
        await Promise.all([
          raw.getAll('projects'),
          raw.getAll('tasks'),
          raw.getAll('pomodoros'),
          raw.getAll('distractions'),
          raw.getAll('notes'),
          raw.get('settings', 'default'),
          raw.getAll('meta'),
        ]);

      return {
        formatVersion: 1,
        exportedAt: Date.now(),
        data: {
          projects,
          tasks,
          pomodoros,
          distractions,
          notes,
          settings: settings ?? {
            id: 'default' as const,
            workMs: 25 * 60_000,
            shortBreakMs: 5 * 60_000,
            longBreakMs: 15 * 60_000,
            longBreakEvery: 4,
            autoStartBreaks: true,
            autoStartNextWork: false,
            allowlist: [],
          },
          meta: metaRows,
        },
      };
    },

    async import(payload: unknown): Promise<void> {
      const parsed = ExportV1Schema.parse(payload);

      const stores = ['projects', 'tasks', 'pomodoros', 'distractions', 'notes', 'settings', 'meta'] as const;
      const tx = raw.transaction(stores, 'readwrite');

      for (const store of stores) {
        await tx.objectStore(store).clear();
      }

      for (const p of parsed.data.projects) {
        await tx.objectStore('projects').put(p);
      }
      for (const t of parsed.data.tasks) {
        await tx.objectStore('tasks').put(t);
      }
      for (const p of parsed.data.pomodoros) {
        await tx.objectStore('pomodoros').put(p);
      }
      for (const d of parsed.data.distractions) {
        await tx.objectStore('distractions').put(d);
      }
      for (const n of parsed.data.notes) {
        await tx.objectStore('notes').put(n);
      }

      await tx.objectStore('settings').put(parsed.data.settings);

      for (const entry of parsed.data.meta) {
        await tx.objectStore('meta').put(entry);
      }

      await tx.done;
    },

    async reset(): Promise<void> {
      await db.resetAllData();
    },
  };
}

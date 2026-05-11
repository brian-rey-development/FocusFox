import { openDB as idbOpenDB } from 'idb';

import { DB_NAME, DB_VERSION, DEFAULT_SETTINGS } from '@/shared/constants';
import type { FocusFoxDB, DB } from './types';
import { migrate } from './migrations';
import { createProjectRepo } from '@/modules/project/infrastructure/repository';
import { createTaskRepo } from '@/modules/task/infrastructure/repository';
import { createPomodoroRepo } from '@/modules/pomodoro/infrastructure/repository';
import { createDistractionRepo } from '@/modules/distraction/infrastructure/repository';
import { createNoteRepo } from '@/modules/note/infrastructure/repository';
import { createSettingsRepo } from '@/modules/settings/infrastructure/repository';
import { createMetaRepo } from '@/modules/meta/infrastructure/repository';

export async function openDB(): Promise<DB> {
  const db = await idbOpenDB<FocusFoxDB>(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion, transaction) {
      migrate(db, oldVersion);

      if (oldVersion < 1) {
        transaction.objectStore('settings').put({
          id: 'default',
          ...DEFAULT_SETTINGS,
        });
      }
    },
  });

  return {
    close: () => db.close(),
    raw: db,
    resetAllData: async () => {
      const stores = ['projects', 'tasks', 'pomodoros', 'distractions', 'notes', 'settings', 'meta'] as const;
      const tx = db.transaction(stores, 'readwrite');
      for (const store of stores) {
        await tx.objectStore(store).clear();
      }
      await tx.done;
      await db.put('settings', { id: 'default', ...DEFAULT_SETTINGS });
    },
    projects: createProjectRepo(db),
    tasks: createTaskRepo(db),
    pomodoros: createPomodoroRepo(db),
    distractions: createDistractionRepo(db),
    notes: createNoteRepo(db),
    settings: createSettingsRepo(db),
    meta: createMetaRepo(db),
  };
}

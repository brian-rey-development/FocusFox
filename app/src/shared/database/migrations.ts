import type { IDBPDatabase } from 'idb';

import type { FocusFoxDB } from './types';
import { projectStore } from '@/modules/project/infrastructure/model';
import { taskStore } from '@/modules/task/infrastructure/model';
import { pomodoroStore } from '@/modules/pomodoro/infrastructure/model';
import { distractionStore } from '@/modules/distraction/infrastructure/model';
import { noteStore } from '@/modules/note/infrastructure/model';
import { settingsStore } from '@/modules/settings/infrastructure/model';
import { metaStore } from '@/modules/meta/infrastructure/model';

const ALL_STORES = [
  projectStore,
  taskStore,
  pomodoroStore,
  distractionStore,
  noteStore,
  settingsStore,
  metaStore,
] as const;

export function migrate(
  db: IDBPDatabase<FocusFoxDB>,
  oldVersion: number,
): void {
  if (oldVersion < 1) {
    for (const config of ALL_STORES) {
      const os = (db as any).createObjectStore(config.name, { keyPath: config.keyPath });
      for (const idx of config.indexes) {
        os.createIndex(idx.name, idx.keyPath);
      }
    }
  }
}

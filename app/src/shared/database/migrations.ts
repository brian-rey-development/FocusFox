import type { IDBPDatabase } from 'idb';

import type { FocusFoxDB } from './types';
import { projectStore } from '@/modules/project/infrastructure/model';
import { taskStore } from '@/modules/task/infrastructure/model';
import { pomodoroStore } from '@/modules/pomodoro/infrastructure/model';
import { distractionStore } from '@/modules/distraction/infrastructure/model';
import { noteStore } from '@/modules/note/infrastructure/model';
import { settingsStore } from '@/modules/settings/infrastructure/model';
import { metaStore } from '@/modules/meta/infrastructure/model';

interface UpgradeDB {
  createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
  objectStoreNames: DOMStringList;
}

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
    const upgradeDb = db as unknown as UpgradeDB;
    for (const config of ALL_STORES) {
      if (upgradeDb.objectStoreNames.contains(config.name)) continue;
      const os = upgradeDb.createObjectStore(config.name, { keyPath: config.keyPath });
      for (const idx of config.indexes) {
        if (!os.indexNames.contains(idx.name)) {
          os.createIndex(idx.name, idx.keyPath);
        }
      }
    }
  }
}

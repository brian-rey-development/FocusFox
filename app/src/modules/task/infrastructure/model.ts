import type { StoreConfig } from '@/shared/database/model';

export const taskStore: StoreConfig = {
  name: 'tasks',
  keyPath: 'id',
  indexes: [
    { name: 'by_project', keyPath: 'projectId' },
    { name: 'by_status', keyPath: 'status' },
  ],
};

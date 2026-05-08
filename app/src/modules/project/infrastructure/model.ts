import type { StoreConfig } from '@/shared/database/model';

export const projectStore: StoreConfig = {
  name: 'projects',
  keyPath: 'id',
  indexes: [{ name: 'by_archived', keyPath: 'archived' }],
};

import type { StoreConfig } from '@/shared/database/model';

export const noteStore: StoreConfig = {
  name: 'notes',
  keyPath: 'id',
  indexes: [
    { name: 'by_day', keyPath: 'day' },
    { name: 'by_at', keyPath: 'at' },
  ],
};

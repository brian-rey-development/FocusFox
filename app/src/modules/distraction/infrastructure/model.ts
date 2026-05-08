import type { StoreConfig } from '@/shared/database/model';

export const distractionStore: StoreConfig = {
  name: 'distractions',
  keyPath: 'id',
  indexes: [
    { name: 'by_pomodoro', keyPath: 'pomodoroId' },
    { name: 'by_at', keyPath: 'at' },
  ],
};

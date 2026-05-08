import type { StoreConfig } from '@/shared/database/model';

export const pomodoroStore: StoreConfig = {
  name: 'pomodoros',
  keyPath: 'id',
  indexes: [
    { name: 'by_task', keyPath: 'taskId' },
    { name: 'by_project', keyPath: 'projectId' },
    { name: 'by_started', keyPath: 'startedAt' },
    { name: 'by_day', keyPath: 'dayKey' },
  ],
};

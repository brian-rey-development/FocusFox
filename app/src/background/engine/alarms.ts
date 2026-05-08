import type { AlarmManager } from './types';

export function createBrowserAlarmManager(): AlarmManager {
  return {
    async schedule(name, when) {
      await browser.alarms.create(name, { when });
    },
    async clear(name) {
      await browser.alarms.clear(name);
    },
  };
}

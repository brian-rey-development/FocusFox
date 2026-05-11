export { PROJECT_COLORS, PROJECT_COLOR_HEX } from '@/modules/project/domain/types';
import type { Settings } from '@/modules/settings/domain/types';

export const DB_NAME = 'focusfox' as const;
export const DB_VERSION = 1 as const;
export const EXTENSION_ID = 'focusfox@brian.dev' as const;

export const DEFAULT_SETTINGS: Omit<Settings, 'id'> = {
  workMs: 25 * 60_000,
  shortBreakMs: 5 * 60_000,
  longBreakMs: 15 * 60_000,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartNextWork: false,
  allowlist: [],
};

export const DISTRACTION_DEDUPE_WINDOW_MS = 30_000;

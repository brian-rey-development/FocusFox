import type { ProjectColor } from '@/modules/project/domain/types';
import type { Settings } from '@/modules/settings/domain/types';

export const DB_NAME = 'focusfox' as const;
export const DB_VERSION = 1 as const;
export const EXTENSION_ID = 'focusfox@brian.dev' as const;

export const PROJECT_COLORS: readonly ProjectColor[] = [
  'blue',
  'amber',
  'green',
  'purple',
  'red',
  'cyan',
] as const;

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

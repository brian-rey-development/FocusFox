import type { ProjectColor } from '@/modules/project/domain/types';
import type { Settings } from '@/modules/settings/domain/types';

export const DB_NAME = 'focusfox' as const;
export const DB_VERSION = 1 as const;
export const EXTENSION_ID = 'focusfox@brian.dev' as const;

export const PROJECT_COLORS: readonly ProjectColor[] = [
  'orange',
  'amber',
  'green',
  'blue',
  'purple',
  'red',
] as const;

export const PROJECT_COLOR_HEX: Record<ProjectColor, string> = {
  orange: '#ff6a00',
  amber: '#f5b82e',
  green: '#23b26b',
  blue: '#2f7df6',
  purple: '#8b5cf6',
  red: '#ef4444',
};

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

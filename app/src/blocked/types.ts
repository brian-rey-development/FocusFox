import type { Tick } from '@/shared/engine-types';
import type { TodayStats } from '@/modules/stats/domain/types';
import type { ProjectColor } from '@/modules/project/domain/types';

export interface BlockedStore {
  snapshot: Tick | null;
  remainingMs: number;
  today: TodayStats | null;
  streakDays: number;
  error: 'unreachable' | null;
  confirmCancel: boolean;

  setSnapshot(s: Tick): void;
  setRemainingMs(ms: number): void;
  setToday(t: TodayStats): void;
  setStreakDays(d: number): void;
  setError(e: BlockedStore['error']): void;
  setConfirmCancel(v: boolean): void;
}

export interface TaskTimeCardProps {
  task: { id: string; title: string };
  project: { name: string; color: ProjectColor };
  remainingMs: number;
  cycleIndex: number;
  longBreakEvery: number;
}

export interface TodayMiniStatsProps {
  today: { workPomodoros: number; distractions: number };
  streakDays: number;
}

export interface CancelLinkProps {
  onCancel(): Promise<void>;
}

export interface AttemptedUrlProps {
  url: string;
}

export interface ErrorToastProps {
  onRetry(): void;
}

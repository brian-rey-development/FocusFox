import type { ProjectColor } from '@/modules/project/domain/types';

export type EnginePhase = 'idle' | 'work' | 'short_break' | 'long_break';

export interface TickTaskInfo {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectColor: ProjectColor;
}

export interface Tick {
  phase: EnginePhase;
  remainingMs: number;
  pomodoroId: string | null;
  plannedDurationMs: number;
  task: TickTaskInfo | null;
  cycleIndex: number;
  longBreakEvery: number;
  distractionCountSession: number;
}

export type EnginePhase = 'idle' | 'work' | 'short_break' | 'long_break';

export interface TickTaskInfo {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  projectColor: string;
}

export interface Tick {
  phase: EnginePhase;
  remainingMs: number;
  pomodoroId: string | null;
  plannedDurationMs: number;
  task: TickTaskInfo | null;
  cycleIndex: number;
  distractionCountSession: number;
}

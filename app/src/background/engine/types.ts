export type EnginePhase = 'idle' | 'work' | 'short_break' | 'long_break';

export interface EngineState {
  phase: EnginePhase;
  pomodoroId: string | null;
  taskId: string | null;
  startedAt: number | null;
  plannedDurationMs: number;
  cycleIndex: number;
  distractionCountSession: number;
}

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

export type PomodoroEvent =
  | { type: 'pomodoro.started'; phase: EnginePhase; startedAt: number; plannedDurationMs: number; taskId: string }
  | { type: 'pomodoro.completed'; pomodoroId: string; taskId: string }
  | { type: 'pomodoro.cancelled'; pomodoroId: string }
  | { type: 'pomodoro.state_change'; from: EnginePhase; to: EnginePhase; at: number };

export interface AlarmManager {
  schedule(name: string, when: number): Promise<void>;
  clear(name: string): Promise<void>;
}

export interface FastStorage {
  get(key: string): Promise<unknown>;
  set(key: string, value: unknown): Promise<void>;
}

export interface EventEmitter {
  broadcast(event: PomodoroEvent): void;
}

import type { EnginePhase, TickTaskInfo, Tick } from '@/shared/engine-types';
import type { PomodoroService } from '@/modules/pomodoro/application/service';
import type { TaskService } from '@/modules/task/application/service';
import type { NoteService } from '@/modules/note/application/service';
import type { SettingsService } from '@/modules/settings/application/service';
import type { DB } from '@/shared/database/types';

export type { EnginePhase, TickTaskInfo, Tick };

export interface EngineState {
  phase: EnginePhase;
  pomodoroId: string | null;
  taskId: string | null;
  startedAt: number | null;
  plannedDurationMs: number;
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

export interface Deps {
  db: DB;
  pomodoroSvc: PomodoroService;
  taskSvc: TaskService;
  noteSvc: NoteService;
  settingsSvc: SettingsService;
  alarmManager: AlarmManager;
  fastStorage: FastStorage;
  eventEmitter: EventEmitter;
}

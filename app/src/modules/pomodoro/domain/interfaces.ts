import type { Pomodoro, PomodoroKind } from './types';

export interface PomodoroRepo {
  start(input: {
    taskId: string;
    projectId: string;
    kind: PomodoroKind;
    plannedDurationMs: number;
    cycleIndex: number;
  }): Promise<Pomodoro>;
  finish(id: string, endedAt: number, completedFully: boolean): Promise<Pomodoro>;
  get(id: string): Promise<Pomodoro | null>;
  listForDay(day: string): Promise<Pomodoro[]>;
  listForRange(fromDay: string, toDay: string): Promise<Pomodoro[]>;
}

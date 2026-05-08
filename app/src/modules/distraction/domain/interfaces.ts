import type { Distraction, DistractionType } from './types';

export interface DistractionRepo {
  add(input: {
    pomodoroId: string;
    type: DistractionType;
    url?: string;
    domain?: string;
    reason?: string;
  }): Promise<Distraction>;
  listForPomodoro(pomodoroId: string): Promise<Distraction[]>;
  recentAutoForDomain(pomodoroId: string, domain: string, withinMs: number): Promise<Distraction | null>;
}

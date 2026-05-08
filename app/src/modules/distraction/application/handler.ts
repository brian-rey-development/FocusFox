import type { DistractionService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createDistractionHandlers(
  svc: DistractionService,
): Record<string, HandlerFn> {
  return {
    'distraction:record': (payload) => svc.record(payload),
    'distraction:listForPomodoro': (payload) => svc.listForPomodoro((payload as { pomodoroId: string }).pomodoroId),
  };
}

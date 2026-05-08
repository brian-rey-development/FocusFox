import type { PomodoroService } from './service';

type HandlerFn = (payload: unknown) => Promise<unknown>;

export function createPomodoroHandlers(
  svc: PomodoroService,
): Record<string, HandlerFn> {
  return {
    'pomodoro:start': (payload) => svc.start(payload),
    'pomodoro:finish': (payload) => svc.finish(
      (payload as { id: string }).id,
      (payload as { completedFully?: boolean }).completedFully,
    ),
    'pomodoro:cancel': (payload) => svc.finish((payload as { id: string }).id, false),
    'pomodoro:skipBreak': (payload) => svc.finish((payload as { id: string }).id, false),
    'pomodoro:getActive': () => svc.getActive(),
    'pomodoro:getTodayStats': () => svc.getTodayStats(),
  };
}

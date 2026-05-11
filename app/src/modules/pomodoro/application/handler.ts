import { z } from 'zod';
import { parsePayload } from '@/shared/message';
import type { PomodoroEngine } from '@/background/engine';
import type { PomodoroService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createPomodoroHandlers(
  engine: PomodoroEngine,
  svc: PomodoroService,
): Record<string, HandlerFn> {
  return {
    'pomodoro:start': (payload) => {
      const { taskId } = parsePayload(payload, z.object({ taskId: z.string() }));
      return engine.start(taskId);
    },
    'pomodoro:cancel': () => engine.cancel(),
    'pomodoro:skipBreak': () => engine.skipBreak(),
    'pomodoro:snapshot': () => engine.getTick(),
    'pomodoro:getActive': () => svc.getActive(),
    'pomodoro:getTodayStats': () => svc.getTodayStats(),
  };
}

import type { DataService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createDataHandlers(
  svc: DataService,
): Record<string, HandlerFn> {
  return {
    'data:export': () => svc.export(),
    'data:import': (payload) => svc.import(payload),
    'data:reset': () => svc.reset(),
  };
}

import type { SettingsService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createSettingsHandlers(
  svc: SettingsService,
): Record<string, HandlerFn> {
  return {
    'settings:get': () => svc.get(),
    'settings:update': (payload) => svc.update(payload),
  };
}

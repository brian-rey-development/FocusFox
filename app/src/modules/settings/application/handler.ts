import type { SettingsService } from './service';

type HandlerFn = (payload: unknown) => Promise<unknown>;

export function createSettingsHandlers(
  svc: SettingsService,
): Record<string, HandlerFn> {
  return {
    'settings:get': () => svc.get(),
    'settings:update': (payload) => svc.update(payload),
  };
}

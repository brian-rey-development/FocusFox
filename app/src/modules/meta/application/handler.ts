import type { MetaService } from './service';

type HandlerFn = (payload: unknown) => Promise<unknown>;

export function createMetaHandlers(
  svc: MetaService,
): Record<string, HandlerFn> {
  return {
    'meta:get': (payload) => svc.get((payload as { key: string }).key),
    'meta:set': (payload) => {
      const { key, value } = payload as { key: string; value: unknown };
      return svc.set(key, value);
    },
  };
}

import type { MetaService } from './service';
import type { HandlerFn } from '@/shared/message';

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

import { z } from 'zod';
import { parsePayload } from '@/shared/message';
import type { MetaService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createMetaHandlers(
  svc: MetaService,
): Record<string, HandlerFn> {
  return {
    'meta:get': (payload) => svc.get(parsePayload(payload, z.object({ key: z.string() })).key),
    'meta:set': (payload) => {
      const { key, value } = parsePayload(payload, z.object({ key: z.string(), value: z.unknown() }));
      return svc.set(key, value);
    },
  };
}

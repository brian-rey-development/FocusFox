import { z } from 'zod';
import { parsePayload } from '@/shared/message';
import type { NoteService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createNoteHandlers(
  svc: NoteService,
): Record<string, HandlerFn> {
  return {
    'note:listForDay': (payload) => svc.listForDay(parsePayload(payload, z.object({ day: z.string() })).day),
    'note:add': (payload) => svc.add(payload),
    'note:update': (payload) => {
      const { id, patch } = parsePayload(payload, z.object({ id: z.string(), patch: z.unknown() }));
      return svc.update(id, patch);
    },
    'note:delete': (payload) => svc.delete(parsePayload(payload, z.object({ id: z.string() })).id),
  };
}

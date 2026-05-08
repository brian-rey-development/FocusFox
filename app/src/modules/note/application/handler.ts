import type { NoteService } from './service';

type HandlerFn = (payload: unknown) => Promise<unknown>;

export function createNoteHandlers(
  svc: NoteService,
): Record<string, HandlerFn> {
  return {
    'note:listForDay': (payload) => svc.listForDay((payload as { day: string }).day),
    'note:add': (payload) => svc.add(payload),
    'note:update': (payload) => {
      const { id, patch } = payload as { id: string; patch: unknown };
      return svc.update(id, patch);
    },
    'note:delete': (payload) => svc.delete((payload as { id: string }).id),
  };
}

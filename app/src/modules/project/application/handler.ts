import type { ProjectService } from './service';

type HandlerFn = (payload: unknown) => Promise<unknown>;

export function createProjectHandlers(
  svc: ProjectService,
): Record<string, HandlerFn> {
  return {
    'project:list': () => svc.list(),
    'project:create': (payload) => svc.create(payload),
    'project:update': (payload) => {
      const { id, patch } = payload as { id: string; patch: unknown };
      return svc.update(id, patch);
    },
    'project:archive': (payload) => svc.archive((payload as { id: string }).id),
    'project:unarchive': (payload) => svc.unarchive((payload as { id: string }).id),
  };
}

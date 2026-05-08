import type { TaskService } from './service';

type HandlerFn = (payload: unknown) => Promise<unknown>;

export function createTaskHandlers(
  svc: TaskService,
): Record<string, HandlerFn> {
  return {
    'task:list': (payload) => svc.list((payload as { projectId: string }).projectId),
    'task:create': (payload) => svc.create(payload),
    'task:update': (payload) => {
      const { id, patch } = payload as { id: string; patch: unknown };
      return svc.update(id, patch);
    },
    'task:setStatus': (payload) => {
      const { id, status } = payload as { id: string; status: unknown };
      return svc.setStatus(id, status);
    },
    'task:delete': (payload) => svc.delete((payload as { id: string }).id),
  };
}

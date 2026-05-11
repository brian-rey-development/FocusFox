import { z } from 'zod';
import { parsePayload } from '@/shared/message';
import type { TaskService } from './service';
import type { HandlerFn } from '@/shared/message';

export function createTaskHandlers(
  svc: TaskService,
): Record<string, HandlerFn> {
  return {
    'task:list': (payload) => svc.list(parsePayload(payload, z.object({ projectId: z.string() })).projectId),
    'task:listAll': (payload) => svc.listAll(parsePayload(payload, z.object({ projectIds: z.array(z.string()) })).projectIds),
    'task:create': (payload) => svc.create(payload),
    'task:update': (payload) => {
      const { id, patch } = parsePayload(payload, z.object({ id: z.string(), patch: z.unknown() }));
      return svc.update(id, patch);
    },
    'task:setStatus': (payload) => {
      const { id, status } = parsePayload(payload, z.object({ id: z.string(), status: z.unknown() }));
      return svc.setStatus(id, status);
    },
    'task:delete': (payload) => svc.delete(parsePayload(payload, z.object({ id: z.string() })).id),
  };
}

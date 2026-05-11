import type { ProjectService } from './service';
import type { HandlerFn } from '@/shared/message';
import { parsePayload } from '@/shared/message';
import { z } from 'zod';
import { CreateProjectSchema, UpdateProjectSchema } from '../domain/types';

export function createProjectHandlers(
  svc: ProjectService,
): Record<string, HandlerFn> {
  return {
    'project:list': () => svc.list(),
    'project:create': (payload) => svc.create(parsePayload(payload, CreateProjectSchema)),
    'project:update': (payload) => {
      const { id, patch } = parsePayload(payload, z.object({ id: z.string(), patch: UpdateProjectSchema }));
      return svc.update(id, patch);
    },
    'project:archive': (payload) => {
      const { id } = parsePayload(payload, z.object({ id: z.string() }));
      return svc.archive(id);
    },
    'project:unarchive': (payload) => {
      const { id } = parsePayload(payload, z.object({ id: z.string() }));
      return svc.unarchive(id);
    },
  };
}

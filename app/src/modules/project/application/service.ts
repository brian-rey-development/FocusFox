import type { DB } from '@/shared/database/types';
import { ConflictError } from '@/shared/errors';
import { CreateProjectSchema, UpdateProjectSchema } from '../domain/types';
import type { Project } from '../domain/types';
import type { TaskService } from '@/modules/task/application/service';

export interface ProjectService {
  list(opts?: { includeArchived?: boolean }): Promise<Project[]>;
  create(input: unknown): Promise<Project>;
  update(id: string, patch: unknown): Promise<Project>;
  archive(id: string): Promise<void>;
  unarchive(id: string): Promise<void>;
}

export function createProjectService(db: DB, taskSvc: TaskService): ProjectService {
  return {
    async list(opts) {
      return db.projects.list(opts);
    },

    async create(input) {
      const parsed = CreateProjectSchema.parse(input);
      return db.projects.create(parsed);
    },

    async update(id, patch) {
      const parsed = UpdateProjectSchema.parse(patch);
      return db.projects.update(id, parsed);
    },

    async archive(id) {
      const tasks = await taskSvc.list(id);
      if (tasks.some((t) => t.status === 'doing')) {
        throw new ConflictError('Cannot archive project with active tasks');
      }
      await db.projects.archive(id);
    },

    async unarchive(id) {
      await db.projects.unarchive(id);
    },
  };
}

import type { IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

import { NotFoundError } from '@/shared/errors';
import type { FocusFoxDB } from '@/shared/database/types';
import type { ProjectRepo } from '../domain/interfaces';
import type { Project } from '../domain/types';

export function createProjectRepo(db: IDBPDatabase<FocusFoxDB>): ProjectRepo {
  return {
    async get(id) {
      const tx = db.transaction('projects', 'readonly');
      const result = await tx.store.get(id);
      return result ?? null;
    },

    async list(opts = {}) {
      const tx = db.transaction('projects', 'readonly');
      const all = await tx.store.getAll();
      return opts.includeArchived ? all : all.filter((p) => !p.archived);
    },

    async create(input) {
      const now = Date.now();
      const project: Project = {
        id: ulid(),
        name: input.name,
        color: input.color,
        createdAt: now,
        archived: false,
      };

      await db.add('projects', project);
      return project;
    },

    async update(id, patch) {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.store;
      const existing = await store.get(id);

      if (!existing) {
        throw new NotFoundError('Project', id);
      }

      const updated: Project = { ...existing, ...patch };
      await store.put(updated);
      await tx.done;
      return updated;
    },

    async archive(id) {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.store;
      const existing = await store.get(id);

      if (!existing) {
        throw new NotFoundError('Project', id);
      }

      existing.archived = true;
      await store.put(existing);
      await tx.done;
    },

    async unarchive(id) {
      const tx = db.transaction('projects', 'readwrite');
      const store = tx.store;
      const existing = await store.get(id);

      if (!existing) {
        throw new NotFoundError('Project', id);
      }

      existing.archived = false;
      await store.put(existing);
      await tx.done;
    },
  };
}

import type { IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

import { NotFoundError } from '@/shared/errors';
import type { FocusFoxDB } from '@/shared/database/types';
import type { TaskRepo } from '../domain/interfaces';
import type { Task } from '../domain/types';

export function createTaskRepo(db: IDBPDatabase<FocusFoxDB>): TaskRepo {
  return {
    async get(id) {
      const tx = db.transaction('tasks', 'readonly');
      const result = await tx.store.get(id);
      return result ?? null;
    },

    async list(projectId) {
      const tx = db.transaction('tasks', 'readonly');
      const index = tx.store.index('by_project');
      return index.getAll(projectId);
    },

    async listAll(projectIds) {
      if (projectIds.length === 0) return [];
      const tx = db.transaction('tasks', 'readonly');
      const index = tx.store.index('by_project');
      const results = await Promise.all(projectIds.map((id) => index.getAll(id)));
      return results.flat();
    },

    async create(input) {
      const now = Date.now();
      const task: Task = {
        id: ulid(),
        projectId: input.projectId,
        title: input.title,
        status: input.status ?? 'todo',
        estimatedPomodoros: input.estimatedPomodoros ?? null,
        completedPomodoros: 0,
        createdAt: now,
        updatedAt: now,
        doneAt: null,
      };

      await db.add('tasks', task);
      return task;
    },

    async update(id, patch) {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.store;
      const existing = await store.get(id);

      if (!existing) {
        throw new NotFoundError('Task', id);
      }

      const updated: Task = {
        ...existing,
        ...patch,
        updatedAt: Date.now(),
      };

      await store.put(updated);
      await tx.done;
      return updated;
    },

    async incrementCompletedPomodoros(taskId) {
      const tx = db.transaction('tasks', 'readwrite');
      const store = tx.store;
      const task = await store.get(taskId);

      if (!task) {
        throw new NotFoundError('Task', taskId);
      }

      await store.put({ ...task, completedPomodoros: task.completedPomodoros + 1, updatedAt: Date.now() });
      await tx.done;
    },

    async delete(id) {
      await db.delete('tasks', id);
    },
  };
}

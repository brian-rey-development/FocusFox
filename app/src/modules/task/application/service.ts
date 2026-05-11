import type { DB } from '@/shared/database/types';
import { NotFoundError, ValidationError } from '@/shared/errors';
import { CreateTaskSchema, TaskStatusSchema, UpdateTaskSchema } from '../domain/types';
import type { Task, TaskStatus } from '../domain/types';

export interface TaskService {
  list(projectId: string): Promise<Task[]>;
  listAll(projectIds: string[]): Promise<Task[]>;
  create(input: unknown): Promise<Task>;
  update(id: string, patch: unknown): Promise<Task>;
  setStatus(id: string, status: unknown): Promise<Task>;
  delete(id: string): Promise<void>;
  incrementCompletedPomodoros(taskId: string): Promise<void>;
}

interface TaskServiceDeps {
  db: DB;
  getActivePomodoroTaskId: () => Promise<string | null>;
}

const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  todo: ['doing'],
  doing: ['done'],
  done: ['todo'],
};

export function createTaskService({ db, getActivePomodoroTaskId }: TaskServiceDeps): TaskService {
  return {
    async list(projectId) {
      return db.tasks.list(projectId);
    },

    async listAll(projectIds) {
      return db.tasks.listAll(projectIds);
    },

    async create(input) {
      const parsed = CreateTaskSchema.parse(input);
      return db.tasks.create(parsed);
    },

    async update(id, patch) {
      const parsed = UpdateTaskSchema.parse(patch);
      return db.tasks.update(id, parsed);
    },

    async setStatus(id, status) {
      const newStatus = TaskStatusSchema.parse(status);
      const task = await db.tasks.get(id);

      if (!task) throw new NotFoundError('Task', id);
      if (task.status === newStatus) return task;

      const allowed = ALLOWED_TRANSITIONS[task.status];
      if (!allowed.includes(newStatus)) {
        throw new ValidationError(`Cannot transition task from ${task.status} to ${newStatus}`);
      }

      const patch: Partial<Task> = { status: newStatus };
      if (newStatus === 'done') {
        patch.doneAt = Date.now();
      }
      return db.tasks.update(id, patch);
    },

    async delete(id) {
      const activeTaskId = await getActivePomodoroTaskId();
      if (activeTaskId === id) {
        throw new ValidationError('Cannot delete a task with an active pomodoro');
      }
      await db.tasks.delete(id);
    },

    async incrementCompletedPomodoros(taskId) {
      await db.tasks.incrementCompletedPomodoros(taskId);
    },
  };
}

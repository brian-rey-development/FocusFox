import type { Task, TaskStatus } from './types';

export interface TaskRepo {
  get(id: string): Promise<Task | null>;
  list(projectId: string): Promise<Task[]>;
  create(input: {
    projectId: string;
    title: string;
    status?: TaskStatus;
    estimatedPomodoros?: number | null;
  }): Promise<Task>;
  update(id: string, patch: Partial<Task>): Promise<Task>;
  incrementCompletedPomodoros(taskId: string): Promise<void>;
  delete(id: string): Promise<void>;
}

import { z } from 'zod';

export const TaskStatusSchema = z.enum(['todo', 'doing', 'done']);
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string().min(1),
  status: TaskStatusSchema,
  estimatedPomodoros: z.number().int().positive().nullable(),
  completedPomodoros: z.number().int().nonnegative(),
  createdAt: z.number(),
  updatedAt: z.number(),
  doneAt: z.number().nullable(),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = z.object({
  projectId: z.string(),
  title: z.string().min(1),
  estimatedPomodoros: z.number().int().positive().nullable().optional().default(null),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial();
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

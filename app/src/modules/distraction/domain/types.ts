import { z } from 'zod';

export const DistractionTypeSchema = z.enum(['auto_blocked_attempt', 'manual']);
export type DistractionType = z.infer<typeof DistractionTypeSchema>;

export const DistractionSchema = z.object({
  id: z.string(),
  pomodoroId: z.string(),
  type: DistractionTypeSchema,
  url: z.string().nullable(),
  domain: z.string().nullable(),
  reason: z.string().nullable(),
  at: z.number(),
});

export type Distraction = z.infer<typeof DistractionSchema>;

export const CreateDistractionSchema = z.object({
  pomodoroId: z.string(),
  type: DistractionTypeSchema,
  url: z.string().optional(),
  domain: z.string().optional(),
  reason: z.string().optional(),
});

export type CreateDistractionInput = z.infer<typeof CreateDistractionSchema>;

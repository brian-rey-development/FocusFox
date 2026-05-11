import { z } from 'zod';

export const MetaRowSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export type MetaRow = z.infer<typeof MetaRowSchema>;

export const MetaSetSchema = z.object({
  key: z.string(),
  value: z.unknown(),
});

export type MetaSetInput = z.infer<typeof MetaSetSchema>;

export interface FooterMeta {
  version: string;
  schemaVersion: number;
  counts: { projects: number; tasks: number; pomodoros: number };
  lastExportAt: number | null;
}

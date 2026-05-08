import { z } from 'zod';

export const SettingsSchema = z.object({
  id: z.literal('default'),
  workMs: z.number().int().positive(),
  shortBreakMs: z.number().int().positive(),
  longBreakMs: z.number().int().positive(),
  longBreakEvery: z.number().int().positive(),
  autoStartBreaks: z.boolean(),
  autoStartNextWork: z.boolean(),
  allowlist: z.array(z.string()),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsSchema = SettingsSchema.omit({ id: true }).partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

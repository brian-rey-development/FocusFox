import { z } from 'zod';

export const SettingsSchema = z.object({
  id: z.literal('default'),
  workMs: z.number().int().positive().max(14_400_000),
  shortBreakMs: z.number().int().positive().max(3_600_000),
  longBreakMs: z.number().int().positive().max(3_600_000),
  longBreakEvery: z.number().int().positive().max(10),
  autoStartBreaks: z.boolean(),
  autoStartNextWork: z.boolean(),
  allowlist: z.array(z.string()),
});

export type Settings = z.infer<typeof SettingsSchema>;

export const UpdateSettingsSchema = SettingsSchema.omit({ id: true }).partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsSchema>;

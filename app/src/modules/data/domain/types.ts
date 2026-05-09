import { z } from 'zod';
import { ProjectSchema } from '@/modules/project/domain/types';
import { TaskSchema } from '@/modules/task/domain/types';
import { PomodoroSchema } from '@/modules/pomodoro/domain/types';
import { DistractionSchema } from '@/modules/distraction/domain/types';
import { NoteEntrySchema } from '@/modules/note/domain/types';
import { SettingsSchema } from '@/modules/settings/domain/types';

export const ExportV1Schema = z.object({
  formatVersion: z.literal(1),
  exportedAt: z.number(),
  data: z.object({
    projects: z.array(ProjectSchema),
    tasks: z.array(TaskSchema),
    pomodoros: z.array(PomodoroSchema),
    distractions: z.array(DistractionSchema),
    notes: z.array(NoteEntrySchema),
    settings: SettingsSchema,
  }),
});

export type ExportPayload = z.infer<typeof ExportV1Schema>;

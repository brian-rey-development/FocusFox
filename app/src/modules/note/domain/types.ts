import { z } from 'zod';

export const NoteEntryKindSchema = z.enum(['user', 'auto']);
export type NoteEntryKind = z.infer<typeof NoteEntryKindSchema>;

export const NoteEntryRefTypeSchema = z.enum(['pomodoro', 'distraction']).nullable();
export type NoteEntryRefType = z.infer<typeof NoteEntryRefTypeSchema>;

export const NoteEntrySchema = z.object({
  id: z.string(),
  day: z.string(),
  at: z.number(),
  kind: NoteEntryKindSchema,
  text: z.string(),
  refType: NoteEntryRefTypeSchema,
  refId: z.string().nullable(),
});

export type NoteEntry = z.infer<typeof NoteEntrySchema>;

export const CreateNoteSchema = z.object({
  day: z.string(),
  kind: NoteEntryKindSchema,
  text: z.string(),
  refType: NoteEntryRefTypeSchema.optional(),
  refId: z.string().optional(),
});

export type CreateNoteInput = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
  text: z.string(),
});

export type UpdateNoteInput = z.infer<typeof UpdateNoteSchema>;

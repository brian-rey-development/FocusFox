import type { DB } from '@/shared/database/types';
import { CreateNoteSchema, UpdateNoteSchema } from '../domain/types';
import type { NoteEntry } from '../domain/types';

export interface NoteService {
  add(input: unknown): Promise<NoteEntry>;
  listForDay(day: string): Promise<NoteEntry[]>;
  update(id: string, patch: unknown): Promise<NoteEntry>;
  delete(id: string): Promise<void>;
}

export function createNoteService(db: DB): NoteService {
  return {
    async add(input) {
      const parsed = CreateNoteSchema.parse(input);
      return db.notes.add(parsed);
    },
    async listForDay(day) {
      return db.notes.listForDay(day);
    },
    async update(id, patch) {
      const parsed = UpdateNoteSchema.parse(patch);
      return db.notes.update(id, parsed);
    },
    async delete(id) {
      await db.notes.delete(id);
    },
  };
}

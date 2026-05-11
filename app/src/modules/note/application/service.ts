import type { DB } from '@/shared/database/types';
import { ValidationError } from '@/shared/errors';
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
      const note = await db.notes.get(id);
      if (!note) throw new Error('Nota no encontrada');
      if (note.kind !== 'user') throw new ValidationError('No se puede editar un registro automático.');
      const parsed = UpdateNoteSchema.parse(patch);
      return db.notes.update(id, parsed);
    },
    async delete(id) {
      const note = await db.notes.get(id);
      if (!note) throw new Error('Nota no encontrada');
      if (note.kind !== 'user') throw new ValidationError('No se puede eliminar un registro automático.');
      await db.notes.delete(id);
    },
  };
}

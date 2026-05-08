import type { IDBPDatabase } from 'idb';
import { ulid } from 'ulid';

import { NotFoundError } from '@/shared/errors';
import type { FocusFoxDB } from '@/shared/database/types';
import type { NoteRepo } from '../domain/interfaces';
import type { NoteEntry } from '../domain/types';

export function createNoteRepo(db: IDBPDatabase<FocusFoxDB>): NoteRepo {
  return {
    async add(input) {
      const note: NoteEntry = {
        id: ulid(),
        day: input.day,
        at: Date.now(),
        kind: input.kind ?? 'user',
        text: input.text,
        refType: input.refType ?? null,
        refId: input.refId ?? null,
      };

      await db.add('notes', note);
      return note;
    },

    async listForDay(day) {
      const tx = db.transaction('notes', 'readonly');
      const index = tx.store.index('by_day');
      return index.getAll(day);
    },

    async update(id, patch) {
      const tx = db.transaction('notes', 'readwrite');
      const store = tx.store;
      const existing = await store.get(id);

      if (!existing) {
        throw new NotFoundError('Note', id);
      }

      const updated: NoteEntry = { ...existing, ...patch };
      await store.put(updated);
      await tx.done;
      return updated;
    },

    async delete(id) {
      await db.delete('notes', id);
    },
  };
}

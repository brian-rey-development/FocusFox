import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createNoteService } from '@/modules/note/service';
import { NoteEntrySchema } from '@/modules/note/domain/types';

describe('NoteService', () => {
  it('add creates a note', async () => {
    const db = await createFreshDB();
    const svc = createNoteService(db);

    const result = await svc.add({ day: '2024-01-15', kind: 'user', text: 'test' });

    expect(NoteEntrySchema.parse(result)).toBeTruthy();
    expect(result.text).toBe('test');
  });

  it('listForDay returns notes for a day', async () => {
    const db = await createFreshDB();
    const svc = createNoteService(db);

    await svc.add({ day: '2024-01-15', kind: 'user', text: 'note 1' });
    await svc.add({ day: '2024-01-15', kind: 'user', text: 'note 2' });
    await svc.add({ day: '2024-01-16', kind: 'user', text: 'different' });

    const notes = await svc.listForDay('2024-01-15');
    expect(notes).toHaveLength(2);
  });

  it('update modifies text', async () => {
    const db = await createFreshDB();
    const svc = createNoteService(db);

    const note = await svc.add({ day: '2024-01-15', kind: 'user', text: 'original' });
    const updated = await svc.update(note.id, { text: 'modified' });

    expect(updated.text).toBe('modified');
  });

  it('delete removes a note', async () => {
    const db = await createFreshDB();
    const svc = createNoteService(db);

    const note = await svc.add({ day: '2024-01-15', kind: 'user', text: 'delete me' });
    await svc.delete(note.id);

    const notes = await svc.listForDay('2024-01-15');
    expect(notes).toHaveLength(0);
  });

  it('rejects invalid input', async () => {
    const db = await createFreshDB();
    const svc = createNoteService(db);

    await expect(svc.add({ kind: 'user', text: 'test' })).rejects.toThrow();
  });
});

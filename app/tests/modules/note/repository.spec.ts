import { describe, it, expect, beforeEach } from 'vitest';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('NoteRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('adds a user note', async () => {
    const note = await db.notes.add({
      day: '2026-05-08',
      kind: 'user',
      text: 'Focused session today',
    });

    expect(note.id).toBeTruthy();
    expect(note.day).toBe('2026-05-08');
    expect(note.kind).toBe('user');
    expect(note.refType).toBeNull();
    expect(note.refId).toBeNull();
  });

  it('adds an auto note with reference', async () => {
    const note = await db.notes.add({
      day: '2026-05-08',
      kind: 'auto',
      text: 'Completed work pomodoro',
      refType: 'pomodoro',
      refId: 'pomo-123',
    });

    expect(note.kind).toBe('auto');
    expect(note.refType).toBe('pomodoro');
    expect(note.refId).toBe('pomo-123');
  });

  it('lists notes for a day', async () => {
    await db.notes.add({ day: '2026-05-08', kind: 'user', text: 'Note 1' });
    await db.notes.add({ day: '2026-05-08', kind: 'auto', text: 'Note 2', refType: 'pomodoro', refId: 'p1' });
    await db.notes.add({ day: '2026-05-09', kind: 'user', text: 'Different day' });

    const list = await db.notes.listForDay('2026-05-08');
    expect(list).toHaveLength(2);
  });

  it('updates note text', async () => {
    const note = await db.notes.add({ day: '2026-05-08', kind: 'user', text: 'Original' });
    const updated = await db.notes.update(note.id, { text: 'Updated text' });
    expect(updated.text).toBe('Updated text');
  });

  it('deletes a note', async () => {
    const note = await db.notes.add({ day: '2026-05-08', kind: 'user', text: 'Delete me' });
    await db.notes.delete(note.id);
    const list = await db.notes.listForDay('2026-05-08');
    expect(list).toHaveLength(0);
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('migrations', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('can interact with all seven stores', async () => {
    const projects = await db.projects.list();
    const tasks = await db.tasks.list('any');
    const pomodoros = await db.pomodoros.listForDay('2026-01-01');
    const distractions = await db.distractions.listForPomodoro('any');
    const notes = await db.notes.listForDay('2026-01-01');
    const settings = await db.settings.get();
    const meta = await db.meta.get('any');

    expect(projects).toEqual([]);
    expect(tasks).toEqual([]);
    expect(pomodoros).toEqual([]);
    expect(distractions).toEqual([]);
    expect(notes).toEqual([]);
    expect(settings.workMs).toBe(25 * 60_000);
    expect(meta).toBeNull();

    db.close();
  });

  it('seeds default settings', async () => {
    db = await createFreshDB();
    const settings = await db.settings.get();
    expect(settings.id).toBe('default');
    expect(settings.workMs).toBe(25 * 60_000);
    expect(settings.shortBreakMs).toBe(5 * 60_000);
    expect(settings.longBreakMs).toBe(15 * 60_000);
    expect(settings.longBreakEvery).toBe(4);
    expect(settings.autoStartBreaks).toBe(true);
    expect(settings.autoStartNextWork).toBe(false);
    expect(settings.allowlist).toEqual([]);
    db.close();
  });
});

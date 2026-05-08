import { describe, it, expect, beforeEach } from 'vitest';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('SettingsRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('returns default settings', async () => {
    const settings = await db.settings.get();
    expect(settings.id).toBe('default');
    expect(settings.workMs).toBe(25 * 60_000);
    expect(settings.shortBreakMs).toBe(5 * 60_000);
  });

  it('updates a single field', async () => {
    const updated = await db.settings.update({ workMs: 30 * 60_000 });
    expect(updated.workMs).toBe(30 * 60_000);
    expect(updated.shortBreakMs).toBe(5 * 60_000);
    expect(updated.longBreakEvery).toBe(4);
  });

  it('updates multiple fields simultaneously', async () => {
    const updated = await db.settings.update({
      workMs: 50 * 60_000,
      shortBreakMs: 10 * 60_000,
      autoStartBreaks: false,
    });
    expect(updated.workMs).toBe(50 * 60_000);
    expect(updated.shortBreakMs).toBe(10 * 60_000);
    expect(updated.autoStartBreaks).toBe(false);
    expect(updated.longBreakEvery).toBe(4);
  });

  it('preserves existing fields on partial update', async () => {
    await db.settings.update({ longBreakMs: 20 * 60_000 });

    const settings = await db.settings.get();
    expect(settings.longBreakMs).toBe(20 * 60_000);
    expect(settings.workMs).toBe(25 * 60_000);
  });
});

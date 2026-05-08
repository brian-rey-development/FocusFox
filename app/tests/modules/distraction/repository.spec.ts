import { describe, it, expect, beforeEach } from 'vitest';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';
import { DISTRACTION_DEDUPE_WINDOW_MS } from '@/shared/constants';

describe('DistractionRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('adds an auto-blocked distraction', async () => {
    const d = await db.distractions.add({
      pomodoroId: 'pomo-1',
      type: 'auto_blocked_attempt',
      url: 'https://reddit.com',
      domain: 'reddit.com',
    });

    expect(d.id).toBeTruthy();
    expect(d.type).toBe('auto_blocked_attempt');
    expect(d.url).toBe('https://reddit.com');
    expect(d.domain).toBe('reddit.com');
    expect(d.reason).toBeNull();
  });

  it('adds a manual distraction with reason', async () => {
    const d = await db.distractions.add({
      pomodoroId: 'pomo-1',
      type: 'manual',
      reason: 'Looked at phone',
    });

    expect(d.type).toBe('manual');
    expect(d.reason).toBe('Looked at phone');
    expect(d.url).toBeNull();
    expect(d.domain).toBeNull();
  });

  it('lists distractions for a pomodoro', async () => {
    await db.distractions.add({ pomodoroId: 'pomo-1', type: 'manual', reason: 'First' });
    await db.distractions.add({ pomodoroId: 'pomo-1', type: 'manual', reason: 'Second' });
    await db.distractions.add({ pomodoroId: 'pomo-2', type: 'manual', reason: 'Other' });

    const list = await db.distractions.listForPomodoro('pomo-1');
    expect(list).toHaveLength(2);
  });

  it('finds a recent auto distraction for same domain', async () => {
    const p = await db.pomodoros.start({
      taskId: 't1', projectId: 'p1', kind: 'work',
      plannedDurationMs: 25 * 60_000, cycleIndex: 1,
    });

    await db.distractions.add({
      pomodoroId: p.id,
      type: 'auto_blocked_attempt',
      domain: 'reddit.com',
      url: 'https://reddit.com',
    });

    const recent = await db.distractions.recentAutoForDomain(
      p.id, 'reddit.com', DISTRACTION_DEDUPE_WINDOW_MS,
    );
    expect(recent).not.toBeNull();
    expect(recent!.domain).toBe('reddit.com');
  });

  it('returns null for different domain', async () => {
    const p = await db.pomodoros.start({
      taskId: 't1', projectId: 'p1', kind: 'work',
      plannedDurationMs: 25 * 60_000, cycleIndex: 1,
    });

    await db.distractions.add({
      pomodoroId: p.id,
      type: 'auto_blocked_attempt',
      domain: 'reddit.com',
    });

    const recent = await db.distractions.recentAutoForDomain(
      p.id, 'twitter.com', DISTRACTION_DEDUPE_WINDOW_MS,
    );
    expect(recent).toBeNull();
  });
});

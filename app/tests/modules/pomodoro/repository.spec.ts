import { describe, it, expect, beforeEach } from 'vitest';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('PomodoroRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('starts a work pomodoro', async () => {
    const p = await db.pomodoros.start({
      taskId: 'task-1',
      projectId: 'proj-1',
      kind: 'work',
      plannedDurationMs: 25 * 60_000,
      cycleIndex: 1,
    });

    expect(p.id).toBeTruthy();
    expect(p.kind).toBe('work');
    expect(p.endedAt).toBeNull();
    expect(p.completedFully).toBe(false);
    expect(p.distractionCount).toBe(0);
    expect(p.dayKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('starts a short break pomodoro', async () => {
    const p = await db.pomodoros.start({
      taskId: 'task-1',
      projectId: 'proj-1',
      kind: 'short_break',
      plannedDurationMs: 5 * 60_000,
      cycleIndex: 2,
    });

    expect(p.kind).toBe('short_break');
    expect(p.cycleIndex).toBe(2);
  });

  it('finishes a pomodoro as completed', async () => {
    const p = await db.pomodoros.start({
      taskId: 'task-1',
      projectId: 'proj-1',
      kind: 'work',
      plannedDurationMs: 25 * 60_000,
      cycleIndex: 1,
    });

    const ended = await db.pomodoros.finish(p.id, Date.now(), true);
    expect(ended.endedAt).toBeGreaterThan(0);
    expect(ended.completedFully).toBe(true);
  });

  it('finishes a pomodoro as cancelled', async () => {
    const p = await db.pomodoros.start({
      taskId: 'task-1',
      projectId: 'proj-1',
      kind: 'work',
      plannedDurationMs: 25 * 60_000,
      cycleIndex: 1,
    });

    const ended = await db.pomodoros.finish(p.id, Date.now(), false);
    expect(ended.completedFully).toBe(false);
  });

  it('gets a pomodoro by id', async () => {
    const p = await db.pomodoros.start({
      taskId: 'task-1',
      projectId: 'proj-1',
      kind: 'work',
      plannedDurationMs: 25 * 60_000,
      cycleIndex: 1,
    });

    const found = await db.pomodoros.get(p.id);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(p.id);
  });

  it('returns null for non-existent pomodoro', async () => {
    const found = await db.pomodoros.get('nonexistent');
    expect(found).toBeNull();
  });

  it('lists pomodoros for a day', async () => {
    const p1 = await db.pomodoros.start({
      taskId: 'task-1', projectId: 'proj-1', kind: 'work',
      plannedDurationMs: 25 * 60_000, cycleIndex: 1,
    });
    await db.pomodoros.start({
      taskId: 'task-1', projectId: 'proj-1', kind: 'short_break',
      plannedDurationMs: 5 * 60_000, cycleIndex: 2,
    });

    const day = p1.dayKey;
    const list = await db.pomodoros.listForDay(day);
    expect(list).toHaveLength(2);
  });

  it('lists pomodoros for a range', async () => {
    const p = await db.pomodoros.start({
      taskId: 'task-1', projectId: 'proj-1', kind: 'work',
      plannedDurationMs: 25 * 60_000, cycleIndex: 1,
    });

    const day = p.dayKey;
    const list = await db.pomodoros.listForRange(day, day);
    expect(list).toHaveLength(1);
  });
});

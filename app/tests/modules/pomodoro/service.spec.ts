import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createPomodoroService } from '@/modules/pomodoro/application/service';
import { PomodoroSchema, TodayStatsSchema } from '@/modules/pomodoro/domain/types';
import { createTaskService } from '@/modules/task/application/service';
import { dayKey } from '@/shared/time';

async function setup() {
  const db = await createFreshDB();
  const taskSvc = createTaskService(db);
  const task = await taskSvc.create({ projectId: 'proj-1', title: 'Test task' });
  const pomoSvc = createPomodoroService(db, taskSvc);
  return { db, taskSvc, pomoSvc, task };
}

describe('PomodoroService', () => {
  it('starts a work pomodoro', async () => {
    const { pomoSvc, task } = await setup();

    const pomodoro = await pomoSvc.start({
      taskId: task.id,
      projectId: 'proj-1',
      kind: 'work',
      plannedDurationMs: 25 * 60_000,
      cycleIndex: 0,
    });

    expect(PomodoroSchema.parse(pomodoro)).toBeTruthy();
    expect(pomodoro.kind).toBe('work');
    expect(pomodoro.endedAt).toBeNull();
    expect(pomodoro.dayKey).toBe(dayKey(Date.now()));
  });

  it('rejects starting a second active pomodoro', async () => {
    const { pomoSvc, task } = await setup();

    await pomoSvc.start({ taskId: task.id, projectId: 'proj-1', kind: 'work', plannedDurationMs: 25 * 60_000, cycleIndex: 0 });
    await expect(pomoSvc.start({ taskId: task.id, projectId: 'proj-1', kind: 'work', plannedDurationMs: 25 * 60_000, cycleIndex: 0 })).rejects.toThrow();
  });

  it('finishes an active pomodoro', async () => {
    const { pomoSvc, task } = await setup();

    const pomodoro = await pomoSvc.start({ taskId: task.id, projectId: 'proj-1', kind: 'work', plannedDurationMs: 25 * 60_000, cycleIndex: 0 });
    const finished = await pomoSvc.finish(pomodoro.id);

    expect(finished.endedAt).not.toBeNull();
    expect(finished.completedFully).toBe(true);
  });

  it('rejects finishing a non-existent pomodoro', async () => {
    const { pomoSvc } = await setup();

    await expect(pomoSvc.finish('nonexistent')).rejects.toThrow();
  });

  it('rejects finishing an already-finished pomodoro', async () => {
    const { pomoSvc, task } = await setup();

    const pomodoro = await pomoSvc.start({ taskId: task.id, projectId: 'proj-1', kind: 'work', plannedDurationMs: 25 * 60_000, cycleIndex: 0 });
    await pomoSvc.finish(pomodoro.id);

    await expect(pomoSvc.finish(pomodoro.id)).rejects.toThrow();
  });

  it('returns null when no active pomodoro', async () => {
    const { pomoSvc } = await setup();

    const active = await pomoSvc.getActive();
    expect(active).toBeNull();
  });

  it('returns active pomodoro when one exists', async () => {
    const { pomoSvc, task } = await setup();

    await pomoSvc.start({ taskId: task.id, projectId: 'proj-1', kind: 'work', plannedDurationMs: 25 * 60_000, cycleIndex: 0 });
    const active = await pomoSvc.getActive();

    expect(active).not.toBeNull();
    expect(active!.endedAt).toBeNull();
  });

  it('returns today stats with work counts', async () => {
    const { pomoSvc, task } = await setup();

    const p1 = await pomoSvc.start({ taskId: task.id, projectId: 'proj-1', kind: 'work', plannedDurationMs: 25 * 60_000, cycleIndex: 0 });
    await pomoSvc.finish(p1.id);

    const stats = await pomoSvc.getTodayStats();

    expect(TodayStatsSchema.parse(stats)).toBeTruthy();
    expect(stats.workCount).toBe(1);
    expect(stats.totalWorkMs).toBe(25 * 60_000);
  });

  it('rejects invalid start input', async () => {
    const { pomoSvc } = await setup();

    await expect(pomoSvc.start({ taskId: 'x', projectId: 'proj-1', kind: 'invalid' })).rejects.toThrow();
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundError } from '@/shared/errors';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('TaskRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('creates a task with minimal input', async () => {
    const task = await db.tasks.create({ projectId: 'proj-1', title: 'My task' });
    expect(task.id).toBeTruthy();
    expect(task.projectId).toBe('proj-1');
    expect(task.title).toBe('My task');
    expect(task.status).toBe('todo');
    expect(task.completedPomodoros).toBe(0);
    expect(task.doneAt).toBeNull();
  });

  it('creates a task with optional fields', async () => {
    const task = await db.tasks.create({
      projectId: 'proj-1',
      title: 'Estimated',
      status: 'doing',
      estimatedPomodoros: 5,
    });
    expect(task.status).toBe('doing');
    expect(task.estimatedPomodoros).toBe(5);
  });

  it('lists tasks by project id', async () => {
    await db.tasks.create({ projectId: 'proj-a', title: 'A1' });
    await db.tasks.create({ projectId: 'proj-a', title: 'A2' });
    await db.tasks.create({ projectId: 'proj-b', title: 'B1' });

    const projA = await db.tasks.list('proj-a');
    const projB = await db.tasks.list('proj-b');

    expect(projA).toHaveLength(2);
    expect(projB).toHaveLength(1);
  });

  it('updates task fields', async () => {
    const task = await db.tasks.create({ projectId: 'p1', title: 'Original' });
    const updated = await db.tasks.update(task.id, { title: 'Updated' });
    expect(updated.title).toBe('Updated');
    expect(updated.createdAt).toBe(task.createdAt);
  });

  it('increments completedPomodoros', async () => {
    const task = await db.tasks.create({ projectId: 'p1', title: 'Count me' });
    expect(task.completedPomodoros).toBe(0);

    await db.tasks.incrementCompletedPomodoros(task.id);
    const after1 = await db.tasks.list('p1');
    expect(after1[0].completedPomodoros).toBe(1);

    await db.tasks.incrementCompletedPomodoros(task.id);
    const after2 = await db.tasks.list('p1');
    expect(after2[0].completedPomodoros).toBe(2);
  });

  it('throws NotFoundError on increment for non-existent task', async () => {
    await expect(db.tasks.incrementCompletedPomodoros('no-such-task')).rejects.toThrow(NotFoundError);
  });

  it('deletes a task', async () => {
    const task = await db.tasks.create({ projectId: 'p1', title: 'Delete me' });
    await db.tasks.delete(task.id);
    const remaining = await db.tasks.list('p1');
    expect(remaining).toHaveLength(0);
  });
});

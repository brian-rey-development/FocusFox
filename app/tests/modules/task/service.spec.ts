import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createTaskService } from '@/modules/task/application/service';
import { TaskSchema } from '@/modules/task/domain/types';

describe('TaskService', () => {
  it('creates a task with defaults', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test task' });

    expect(TaskSchema.parse(task)).toBeTruthy();
    expect(task.status).toBe('todo');
    expect(task.completedPomodoros).toBe(0);
  });

  it('lists tasks for a project', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    await svc.create({ projectId: 'proj-1', title: 'Task 1' });
    await svc.create({ projectId: 'proj-1', title: 'Task 2' });
    await svc.create({ projectId: 'proj-2', title: 'Task 3' });

    const tasks = await svc.list('proj-1');
    expect(tasks).toHaveLength(2);
  });

  it('updates a task', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Original' });
    const updated = await svc.update(task.id, { title: 'Updated' });

    expect(updated.title).toBe('Updated');
  });

  it('rejects invalid update input', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test' });
    await expect(svc.update(task.id, { title: '' })).rejects.toThrow();
  });

  it('transitions todo to doing', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test' });
    const updated = await svc.setStatus(task.id, 'doing');

    expect(updated.status).toBe('doing');
  });

  it('transitions doing to done', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test' });
    await svc.setStatus(task.id, 'doing');
    const updated = await svc.setStatus(task.id, 'done');

    expect(updated.status).toBe('done');
    expect(updated.doneAt).not.toBeNull();
  });

  it('reverts doing to todo', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test' });
    await svc.setStatus(task.id, 'doing');

    await expect(svc.setStatus(task.id, 'todo')).rejects.toThrow();
  });

  it('reverts done to anything', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test' });
    await svc.setStatus(task.id, 'doing');
    await svc.setStatus(task.id, 'done');

    await expect(svc.setStatus(task.id, 'todo')).rejects.toThrow();
    await expect(svc.setStatus(task.id, 'doing')).rejects.toThrow();
  });

  it('deletes a task', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Delete me' });
    await svc.delete(task.id);

    const tasks = await svc.list('proj-1');
    expect(tasks).toHaveLength(0);
  });

  it('increments completed pomodoros', async () => {
    const db = await createFreshDB();
    const svc = createTaskService(db);

    const task = await svc.create({ projectId: 'proj-1', title: 'Test' });
    await svc.incrementCompletedPomodoros(task.id);

    const after = await db.tasks.get(task.id);
    expect(after?.completedPomodoros).toBe(1);
  });
});

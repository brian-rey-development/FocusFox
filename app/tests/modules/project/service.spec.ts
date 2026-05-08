import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createProjectService } from '@/modules/project/service';
import { ProjectSchema } from '@/modules/project/domain/types';
import { createTaskService } from '@/modules/task/service';

describe('ProjectService', () => {
  it('creates a project', async () => {
    const db = await createFreshDB();
    const svc = createProjectService(db, createTaskService(db));

    const project = await svc.create({ name: 'My Project', color: 'blue' });

    expect(ProjectSchema.parse(project)).toBeTruthy();
    expect(project.archived).toBe(false);
  });

  it('lists active projects by default', async () => {
    const db = await createFreshDB();
    const svc = createProjectService(db, createTaskService(db));

    await svc.create({ name: 'Active', color: 'green' });
    const archived = await svc.create({ name: 'Archived', color: 'red' });
    await svc.archive(archived.id);

    const projects = await svc.list();
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Active');
  });

  it('updates a project', async () => {
    const db = await createFreshDB();
    const svc = createProjectService(db, createTaskService(db));

    const project = await svc.create({ name: 'Original', color: 'blue' });
    const updated = await svc.update(project.id, { name: 'Updated' });

    expect(updated.name).toBe('Updated');
  });

  it('archives a project', async () => {
    const db = await createFreshDB();
    const svc = createProjectService(db, createTaskService(db));

    const project = await svc.create({ name: 'Test', color: 'blue' });
    await svc.archive(project.id);

    const all = await svc.list({ includeArchived: true });
    expect(all[0].archived).toBe(true);
  });

  it('unarchives a project', async () => {
    const db = await createFreshDB();
    const svc = createProjectService(db, createTaskService(db));

    const project = await svc.create({ name: 'Test', color: 'blue' });
    await svc.archive(project.id);
    await svc.unarchive(project.id);

    const all = await svc.list({ includeArchived: true });
    expect(all[0].archived).toBe(false);
  });

  it('rejects invalid create input', async () => {
    const db = await createFreshDB();
    const svc = createProjectService(db, createTaskService(db));

    await expect(svc.create({ name: '', color: 'blue' })).rejects.toThrow();
  });

  it('rejects archive with active tasks', async () => {
    const db = await createFreshDB();
    const taskSvc = createTaskService(db);
    const svc = createProjectService(db, taskSvc);

    const project = await svc.create({ name: 'Busy', color: 'blue' });
    const task = await taskSvc.create({ projectId: project.id, title: 'Active task' });
    await taskSvc.setStatus(task.id, 'doing');

    await expect(svc.archive(project.id)).rejects.toThrow();
  });
});

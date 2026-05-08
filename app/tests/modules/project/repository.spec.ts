import { describe, it, expect, beforeEach } from 'vitest';
import { NotFoundError } from '@/shared/errors';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('ProjectRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('creates a project with defaults', async () => {
    const project = await db.projects.create({ name: 'Test', color: 'blue' });
    expect(project.id).toBeTruthy();
    expect(project.name).toBe('Test');
    expect(project.color).toBe('blue');
    expect(project.archived).toBe(false);
    expect(project.createdAt).toBeGreaterThan(0);
  });

  it('lists non-archived projects by default', async () => {
    await db.projects.create({ name: 'Active', color: 'green' });
    await db.projects.create({ name: 'Also Active', color: 'red' });

    const active = await db.projects.list();
    expect(active).toHaveLength(2);
  });

  it('hides archived projects from default list', async () => {
    const p = await db.projects.create({ name: 'ToArchive', color: 'amber' });
    await db.projects.archive(p.id);
    const active = await db.projects.list();
    expect(active).toHaveLength(0);
  });

  it('includes archived projects with includeArchived', async () => {
    const p = await db.projects.create({ name: 'ToArchive', color: 'amber' });
    await db.projects.archive(p.id);
    const all = await db.projects.list({ includeArchived: true });
    expect(all).toHaveLength(1);
    expect(all[0].archived).toBe(true);
  });

  it('archives and unarchives', async () => {
    const p = await db.projects.create({ name: 'Toggle', color: 'purple' });

    await db.projects.archive(p.id);
    const archived = await db.projects.list({ includeArchived: true });
    expect(archived[0].archived).toBe(true);

    await db.projects.unarchive(p.id);
    const unarchived = await db.projects.list({ includeArchived: true });
    expect(unarchived[0].archived).toBe(false);
  });

  it('updates project fields', async () => {
    const p = await db.projects.create({ name: 'Original', color: 'blue' });
    const updated = await db.projects.update(p.id, { name: 'Renamed', color: 'red' });
    expect(updated.name).toBe('Renamed');
    expect(updated.color).toBe('red');
  });

  it('throws NotFoundError on update of non-existent project', async () => {
    await expect(db.projects.update('nonexistent', { name: 'x' })).rejects.toThrow(NotFoundError);
  });
});

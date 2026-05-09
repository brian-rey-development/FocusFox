import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createDataService } from '@/modules/data/application/service';
import type { ExportPayload } from '@/modules/data/domain/types';
import { ExportV1Schema } from '@/modules/data/domain/types';

function exportedAtOrZero(p: ExportPayload): ExportPayload {
  return { ...p, exportedAt: 0 };
}

describe('DataService', () => {
  describe('export', () => {
    it('exports empty db', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      const payload = await svc.export();

      expect(payload.formatVersion).toBe(1);
      expect(payload.exportedAt).toBeGreaterThan(0);
      expect(payload.data.projects).toEqual([]);
      expect(payload.data.tasks).toEqual([]);
      expect(payload.data.pomodoros).toEqual([]);
      expect(payload.data.distractions).toEqual([]);
      expect(payload.data.notes).toEqual([]);
      expect(payload.data.settings.id).toBe('default');
    });

    it('passes schema validation', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      const payload = await svc.export();

      expect(() => ExportV1Schema.parse(payload)).not.toThrow();
    });

    it('exports seeded data', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      const project = await db.projects.create({ name: 'Test', color: 'blue' });
      const task = await db.tasks.create({ projectId: project.id, title: 'Task 1' });
      await db.pomodoros.start({
        taskId: task.id,
        projectId: project.id,
        kind: 'work',
        plannedDurationMs: 25 * 60_000,
        cycleIndex: 1,
      });
      await db.notes.add({
        day: '2026-05-08',
        kind: 'user',
        text: 'test note',
      });

      const payload = await svc.export();

      expect(payload.data.projects).toHaveLength(1);
      expect(payload.data.projects[0].name).toBe('Test');
      expect(payload.data.tasks).toHaveLength(1);
      expect(payload.data.tasks[0].title).toBe('Task 1');
      expect(payload.data.pomodoros).toHaveLength(1);
      expect(payload.data.notes).toHaveLength(1);
      expect(payload.data.settings.id).toBe('default');
    });
  });

  describe('import', () => {
    it('round-trips seeded data', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      const project = await db.projects.create({ name: 'RoundTrip', color: 'green' });
      const task = await db.tasks.create({ projectId: project.id, title: 'RT Task' });
      const pomodoro = await db.pomodoros.start({
        taskId: task.id,
        projectId: project.id,
        kind: 'work',
        plannedDurationMs: 25 * 60_000,
        cycleIndex: 1,
      });
      await db.distractions.add({
        pomodoroId: pomodoro.id,
        type: 'auto_blocked_attempt',
        url: 'https://example.com',
        domain: 'example.com',
      });

      const payload1 = await svc.export();

      await db.resetAllData();
      await svc.import(payload1);

      const payload2 = await svc.export();

      expect(exportedAtOrZero(payload2)).toEqual(exportedAtOrZero(payload1));
    });

    it('replaces existing data on import', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await db.projects.create({ name: 'Old', color: 'amber' });

      const payload1 = await svc.export();
      await db.resetAllData();

      await db.projects.create({ name: 'New', color: 'blue' });
      await svc.import(payload1);

      const projects = await db.raw.getAll('projects');
      expect(projects).toHaveLength(1);
      expect(projects[0].name).toBe('Old');
    });

    it('rejects wrong formatVersion', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await expect(
        svc.import({ formatVersion: 2, exportedAt: 1, data: {} }),
      ).rejects.toThrow();
    });

    it('rejects missing data key', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await expect(
        svc.import({ formatVersion: 1, exportedAt: 1 }),
      ).rejects.toThrow();
    });

    it('rejects non-object payload', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await expect(svc.import('bad')).rejects.toThrow();
      await expect(svc.import(null)).rejects.toThrow();
      await expect(svc.import(undefined)).rejects.toThrow();
    });

    it('rejects payload with invalid project data', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await expect(
        svc.import({
          formatVersion: 1,
          exportedAt: 1,
          data: {
            projects: [{ invalid: true }],
            tasks: [],
            pomodoros: [],
            distractions: [],
            notes: [],
            settings: { id: 'default', workMs: 0, shortBreakMs: 0, longBreakMs: 0, longBreakEvery: 0, autoStartBreaks: false, autoStartNextWork: false, allowlist: [] },
          },
        }),
      ).rejects.toThrow();
    });

    it('rejects payload with missing store', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await expect(
        svc.import({
          formatVersion: 1,
          exportedAt: 1,
          data: {
            projects: [],
            tasks: [],
            // missing pomodoros
            distractions: [],
            notes: [],
            settings: { id: 'default', workMs: 25 * 60_000, shortBreakMs: 5 * 60_000, longBreakMs: 15 * 60_000, longBreakEvery: 4, autoStartBreaks: true, autoStartNextWork: false, allowlist: [] },
          },
        }),
      ).rejects.toThrow();
    });
  });

  describe('reset', () => {
    it('clears all data', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      const project = await db.projects.create({ name: 'To Delete', color: 'red' });
      await db.tasks.create({ projectId: project.id, title: 'Task to delete' });

      await svc.reset();

      const projects = await db.raw.getAll('projects');
      const tasks = await db.raw.getAll('tasks');
      expect(projects).toEqual([]);
      expect(tasks).toEqual([]);
    });

    it('re-seeds settings after reset', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await svc.reset();

      const settings = await db.settings.get();
      expect(settings.workMs).toBe(25 * 60_000);
      expect(settings.id).toBe('default');
    });
  });

  describe('integration', () => {
    it('export -> import preserves settings changes', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await db.settings.update({ workMs: 50 * 60_000, longBreakEvery: 3 });

      const payload = await svc.export();
      await db.resetAllData();
      await svc.import(payload);

      const restored = await db.settings.get();
      expect(restored.workMs).toBe(50 * 60_000);
      expect(restored.longBreakEvery).toBe(3);
    });

    it('import with empty collections works', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      const payload = await svc.export();
      await db.resetAllData();
      await svc.import(payload);

      const payload2 = await svc.export();
      expect(exportedAtOrZero(payload2)).toEqual(exportedAtOrZero(payload));
    });

    it('import into already-populated db replaces everything', async () => {
      const db = await createFreshDB();
      const svc = createDataService(db);

      await db.projects.create({ name: 'X', color: 'purple' });
      const before = await svc.export();

      await db.resetAllData();

      await db.projects.create({ name: 'Y', color: 'orange' });
      await svc.import(before);

      const after = await svc.export();
      expect(exportedAtOrZero(after)).toEqual(exportedAtOrZero(before));
    });
  });
});

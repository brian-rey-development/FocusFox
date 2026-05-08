import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createPomodoroService } from '@/modules/pomodoro/application/service';
import { createTaskService } from '@/modules/task/application/service';
import { createNoteService } from '@/modules/note/application/service';
import { createSettingsService } from '@/modules/settings/application/service';
import { createProjectService } from '@/modules/project/application/service';
import { createPomodoroEngine } from '@/background/engine';
import type { AlarmManager, FastStorage, EventEmitter, PomodoroEvent } from '@/background/engine/types';

function createMockAlarmManager(): AlarmManager & { scheduled: Map<string, number> } {
  const scheduled = new Map<string, number>();
  return {
    scheduled,
    async schedule(name, when) {
      scheduled.set(name, when);
    },
    async clear(name) {
      scheduled.delete(name);
    },
  };
}

function createMockFastStorage(): FastStorage & { data: Map<string, unknown> } {
  const data = new Map<string, unknown>();
  return {
    data,
    async get(key) {
      return data.get(key);
    },
    async set(key, value) {
      data.set(key, value);
    },
  };
}

function createMockEventEmitter(): EventEmitter & { events: PomodoroEvent[] } {
  const events: PomodoroEvent[] = [];
  return {
    events,
    broadcast(event) {
      events.push(event);
    },
  };
}

async function setupEngine() {
  const db = await createFreshDB();
  const taskSvc = createTaskService(db);
  const noteSvc = createNoteService(db);
  const settingsSvc = createSettingsService(db);
  const projectSvc = createProjectService(db, taskSvc);
  const pomodoroSvc = createPomodoroService(db, taskSvc);

  const alarmManager = createMockAlarmManager();
  const fastStorage = createMockFastStorage();
  const eventEmitter = createMockEventEmitter();

  const engine = createPomodoroEngine({
    db,
    pomodoroSvc,
    taskSvc,
    noteSvc,
    settingsSvc,
    alarmManager,
    fastStorage,
    eventEmitter,
  });

  return { db, engine, taskSvc, projectSvc, alarmManager, fastStorage, eventEmitter };
}

describe('PomodoroEngine', () => {
  describe('hydrate', () => {
    it('loads idle state when no persisted state exists', async () => {
      const { engine } = await setupEngine();
      await engine.hydrate();

      expect(engine.currentPhase()).toBe('idle');
      expect(engine.currentPomodoroId()).toBeNull();
    });

    it('loads persisted state from fast storage', async () => {
      const { engine, fastStorage } = await setupEngine();
      const persisted = {
        phase: 'work' as const,
        pomodoroId: 'pomo-1',
        taskId: 'task-1',
        startedAt: Date.now() - 1000,
        plannedDurationMs: 1500000,
        cycleIndex: 2,
        distractionCountSession: 3,
      };
      await fastStorage.set('engineState', persisted);
      await engine.hydrate();

      expect(engine.currentPhase()).toBe('work');
    });
  });

  describe('recover', () => {
    it('resets to idle when elapsed >= planned (completed while down)', async () => {
      const { engine, fastStorage } = await setupEngine();
      const now = Date.now();
      await fastStorage.set('engineState', {
        phase: 'work',
        pomodoroId: 'pomo-1',
        taskId: 'task-1',
        startedAt: now - 2000,
        plannedDurationMs: 1000,
        cycleIndex: 1,
        distractionCountSession: 0,
      });
      await engine.hydrate();
      await engine.recover();

      expect(engine.currentPhase()).toBe('idle');
    });

    it('reschedules alarm when elapsed < planned', async () => {
      const { engine, fastStorage, alarmManager } = await setupEngine();
      const now = Date.now();
      const startedAt = now - 5000;
      const plannedDurationMs = 60000;
      await fastStorage.set('engineState', {
        phase: 'work',
        pomodoroId: 'pomo-1',
        taskId: 'task-1',
        startedAt,
        plannedDurationMs,
        cycleIndex: 1,
        distractionCountSession: 0,
      });
      await engine.hydrate();
      await engine.recover();

      expect(engine.currentPhase()).toBe('work');
      expect(alarmManager.scheduled.has('pomodoro_transition')).toBe(true);
    });
  });

  describe('start', () => {
    it('transitions idle -> work and schedules alarm', async () => {
      const { engine, taskSvc, projectSvc, alarmManager, eventEmitter } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });

      const result = await engine.start(task.id);

      expect(result.ok).toBe(true);
      expect(engine.currentPhase()).toBe('work');
      expect(alarmManager.scheduled.has('pomodoro_transition')).toBe(true);
      expect(eventEmitter.events.some((e) => e.type === 'pomodoro.started')).toBe(true);
    });

    it('auto-transitions task todo -> doing', async () => {
      const { engine, taskSvc, projectSvc, db } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      expect(task.status).toBe('todo');

      await engine.start(task.id);

      const updated = await db.tasks.get(task.id);
      expect(updated?.status).toBe('doing');
    });

    it('rejects start when busy', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      const result = await engine.start(task.id);
      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: string }).error).toBe('busy');
    });

    it('rejects start when task not found', async () => {
      const { engine } = await setupEngine();
      await engine.hydrate();

      const result = await engine.start('nonexistent');
      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: string }).error).toBe('task_not_found');
    });
  });

  describe('cancel', () => {
    it('transitions work -> idle', async () => {
      const { engine, taskSvc, projectSvc, alarmManager, eventEmitter } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      await engine.cancel();

      expect(engine.currentPhase()).toBe('idle');
      expect(alarmManager.scheduled.has('pomodoro_transition')).toBe(false);
      expect(eventEmitter.events.some((e) => e.type === 'pomodoro.cancelled')).toBe(true);
    });

    it('cancels break -> idle', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);
      await engine.handleCompletion();

      expect(engine.currentPhase()).toBe('short_break');

      await engine.cancel();

      expect(engine.currentPhase()).toBe('idle');
    });
  });

  describe('handleCompletion', () => {
    it('work -> short_break when cycleIndex < longBreakEvery', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      await engine.handleCompletion();

      expect(engine.currentPhase()).toBe('short_break');
    });

    it('work -> long_break when cycleIndex === longBreakEvery', async () => {
      const { engine, taskSvc, projectSvc, fastStorage } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });

      // Set cycleIndex to 4 (matching default longBreakEvery=4)
      await fastStorage.set('engineState', {
        phase: 'idle',
        pomodoroId: null,
        taskId: null,
        startedAt: null,
        plannedDurationMs: 0,
        cycleIndex: 4,
        distractionCountSession: 0,
      });
      await engine.hydrate();

      await engine.start(task.id);
      await engine.handleCompletion();

      expect(engine.currentPhase()).toBe('long_break');
    });

    it('cycleIndex wraps after longBreakEvery', async () => {
      const { engine, taskSvc, projectSvc, fastStorage } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });

      await fastStorage.set('engineState', {
        phase: 'idle',
        pomodoroId: null,
        taskId: null,
        startedAt: null,
        plannedDurationMs: 0,
        cycleIndex: 4,
        distractionCountSession: 0,
      });
      await engine.hydrate();

      await engine.start(task.id);
      await engine.handleCompletion();
      await engine.handleCompletion(); // complete break

      const tick = await engine.getTick();
      expect(tick.cycleIndex).toBe(1);
    });
  });

  describe('skipBreak', () => {
    it('skips short_break -> idle', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);
      await engine.handleCompletion();

      expect(engine.currentPhase()).toBe('short_break');

      const result = await engine.skipBreak();
      expect(result.ok).toBe(true);
      expect(engine.currentPhase()).toBe('idle');
    });

    it('rejects skipBreak when not in break', async () => {
      const { engine } = await setupEngine();
      await engine.hydrate();

      const result = await engine.skipBreak();
      expect(result.ok).toBe(false);
      expect((result as { ok: false; error: string }).error).toBe('not_in_break');
    });
  });

  describe('recordDistraction', () => {
    it('increments distractionCountSession for active work pomodoro', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      const tick1 = await engine.getTick();
      expect(tick1.distractionCountSession).toBe(0);

      engine.recordDistraction(tick1.pomodoroId!);
      engine.recordDistraction(tick1.pomodoroId!);

      const tick2 = await engine.getTick();
      expect(tick2.distractionCountSession).toBe(2);
    });

    it('ignores distraction for wrong pomodoroId', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      engine.recordDistraction('wrong-id');

      const tick = await engine.getTick();
      expect(tick.distractionCountSession).toBe(0);
    });
  });

  describe('handleDailyReset', () => {
    it('resets cycleIndex to 1', async () => {
      const { engine, fastStorage } = await setupEngine();
      await engine.hydrate();

      await fastStorage.set('engineState', {
        phase: 'idle',
        pomodoroId: null,
        taskId: null,
        startedAt: null,
        plannedDurationMs: 0,
        cycleIndex: 3,
        distractionCountSession: 0,
      });
      await engine.hydrate();

      await engine.handleDailyReset();

      const tick = await engine.getTick();
      expect(tick.cycleIndex).toBe(1);
    });
  });

  describe('getTick', () => {
    it('returns idle tick when no active pomodoro', async () => {
      const { engine } = await setupEngine();
      await engine.hydrate();

      const tick = await engine.getTick();
      expect(tick.phase).toBe('idle');
      expect(tick.pomodoroId).toBeNull();
      expect(tick.remainingMs).toBe(0);
    });

    it('returns work tick with task info', async () => {
      const { engine, taskSvc, projectSvc } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      const tick = await engine.getTick();
      expect(tick.phase).toBe('work');
      expect(tick.pomodoroId).not.toBeNull();
      expect(tick.task).not.toBeNull();
      expect(tick.task!.title).toBe('T');
      expect(tick.task!.projectName).toBe('P');
      expect(tick.remainingMs).toBeGreaterThan(0);
      expect(tick.remainingMs).toBeLessThanOrEqual(tick.plannedDurationMs);
    });
  });

  describe('events', () => {
    it('broadcasts state_change on transitions', async () => {
      const { engine, taskSvc, projectSvc, eventEmitter } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      expect(eventEmitter.events.some((e) => e.type === 'pomodoro.state_change' && e.from === 'idle' && e.to === 'work')).toBe(true);

      await engine.handleCompletion();

      expect(eventEmitter.events.some((e) => e.type === 'pomodoro.state_change' && e.from === 'work' && e.to === 'short_break')).toBe(true);
    });

    it('broadcasts completed on work finish', async () => {
      const { engine, taskSvc, projectSvc, eventEmitter } = await setupEngine();
      await engine.hydrate();

      const project = await projectSvc.create({ name: 'P', color: 'blue' });
      const task = await taskSvc.create({ projectId: project.id, title: 'T' });
      await engine.start(task.id);

      await engine.handleCompletion();

      expect(eventEmitter.events.some((e) => e.type === 'pomodoro.completed')).toBe(true);
    });
  });
});

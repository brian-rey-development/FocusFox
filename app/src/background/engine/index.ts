import { NotFoundError } from '@/shared/errors';
import { dayKey } from '@/shared/time';
import type { DB } from '@/shared/database/types';
import type { PomodoroService } from '@/modules/pomodoro/application/service';
import type { TaskService } from '@/modules/task/application/service';
import type { NoteService } from '@/modules/note/application/service';
import type { SettingsService } from '@/modules/settings/application/service';
import type {
  EnginePhase,
  EngineState,
  Tick,
  TickTaskInfo,
  AlarmManager,
  FastStorage,
  EventEmitter,
} from './types';
import { loadEngineState, saveEngineState } from './persistence';

const POMODORO_TRANSITION_ALARM = 'pomodoro_transition';
const DEFAULT_SETTINGS_SNAPSHOT = {
  workMs: 25 * 60_000,
  shortBreakMs: 5 * 60_000,
  longBreakMs: 15 * 60_000,
  longBreakEvery: 4,
  autoStartBreaks: true,
  autoStartNextWork: false,
};

function defaultState(): EngineState {
  return {
    phase: 'idle',
    pomodoroId: null,
    taskId: null,
    startedAt: null,
    plannedDurationMs: 0,
    cycleIndex: 1,
    distractionCountSession: 0,
  };
}

function cloneState(s: EngineState): EngineState {
  return { ...s };
}

function nextBreakKind(cycleIndex: number, longBreakEvery: number): 'short_break' | 'long_break' {
  return cycleIndex === longBreakEvery ? 'long_break' : 'short_break';
}

function remainingMs(state: EngineState): number {
  if (state.phase === 'idle' || state.startedAt === null) return 0;
  return Math.max(0, state.plannedDurationMs - (Date.now() - state.startedAt));
}

export interface PomodoroEngine {
  hydrate(): Promise<void>;
  recover(): Promise<void>;
  start(taskId: string): Promise<{ ok: true; phase: EnginePhase; startedAt: number; plannedDurationMs: number } | { ok: false; error: string }>;
  cancel(): Promise<void>;
  skipBreak(): Promise<{ ok: true } | { ok: false; error: string }>;
  handleCompletion(): Promise<void>;
  handleDailyReset(): Promise<void>;
  getTick(): Promise<Tick>;
  recordDistraction(pomodoroId: string): void;
  currentPhase(): EnginePhase;
  currentPomodoroId(): string | null;
}

interface Deps {
  db: DB;
  pomodoroSvc: PomodoroService;
  taskSvc: TaskService;
  noteSvc: NoteService;
  settingsSvc: SettingsService;
  alarmManager: AlarmManager;
  fastStorage: FastStorage;
  eventEmitter: EventEmitter;
}

export function createPomodoroEngine(deps: Deps): PomodoroEngine {
  let state = defaultState();
  let cachedTaskInfo: TickTaskInfo | null = null;

  async function getSettings() {
    try {
      return await deps.settingsSvc.get();
    } catch {
      return DEFAULT_SETTINGS_SNAPSHOT;
    }
  }

  async function persist(): Promise<void> {
    await saveEngineState(deps.fastStorage, deps.db, cloneState(state));
  }

  async function clearTransitionAlarm(): Promise<void> {
    await deps.alarmManager.clear(POMODORO_TRANSITION_ALARM);
  }

  async function scheduleTransitionAlarm(when: number): Promise<void> {
    await deps.alarmManager.schedule(POMODORO_TRANSITION_ALARM, when);
  }

  function broadcast(event: Parameters<EventEmitter['broadcast']>[0]): void {
    deps.eventEmitter.broadcast(event);
  }

  async function cacheTaskInfo(taskId: string): Promise<void> {
    const task = await deps.db.tasks.get(taskId);
    if (!task) {
      cachedTaskInfo = null;
      return;
    }
    const projects = await deps.db.projects.list({ includeArchived: true });
    const project = projects.find((p) => p.id === task.projectId);
    cachedTaskInfo = {
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      projectName: project?.name ?? '(unknown)',
      projectColor: project?.color ?? 'red',
    };
  }

  async function createWorkPomodoro(taskId: string, plannedDurationMs: number, cycleIndex: number): Promise<string> {
    const task = await deps.db.tasks.get(taskId);
    if (!task) throw new NotFoundError('Task', taskId);

    const pomodoro = await deps.pomodoroSvc.start({
      taskId,
      projectId: task.projectId,
      kind: 'work',
      plannedDurationMs,
      cycleIndex,
    });

    return pomodoro.id;
  }

  async function createBreakPomodoro(taskId: string, kind: 'short_break' | 'long_break', plannedDurationMs: number, cycleIndex: number): Promise<string> {
    const task = await deps.db.tasks.get(taskId);
    if (!task) throw new NotFoundError('Task', taskId);

    const pomodoro = await deps.pomodoroSvc.start({
      taskId,
      projectId: task.projectId,
      kind,
      plannedDurationMs,
      cycleIndex,
    });

    return pomodoro.id;
  }

  async function finishPomodoro(completedFully: boolean): Promise<void> {
    if (!state.pomodoroId) return;
    try {
      await deps.pomodoroSvc.finish(state.pomodoroId, completedFully, state.distractionCountSession);
    } catch {
      // Best-effort: ignore missing or already-finished pomodoro
    }
  }

  async function transitionTo(next: EnginePhase): Promise<void> {
    const from = state.phase;
    state = cloneState(state);
    state.phase = next;
    await persist();
    broadcast({ type: 'pomodoro.state_change', from, to: next, at: Date.now() });
  }

  async function resetToIdle(): Promise<void> {
    state.pomodoroId = null;
    state.taskId = null;
    state.startedAt = null;
    state.plannedDurationMs = 0;
    state.distractionCountSession = 0;
    cachedTaskInfo = null;
    await persist();
  }

  async function startWork(taskId: string, plannedDurationMs: number): Promise<void> {
    const task = await deps.db.tasks.get(taskId);
    if (!task) throw new NotFoundError('Task', taskId);

    if (task.status === 'todo') {
      await deps.taskSvc.setStatus(taskId, 'doing');
    }

    const pomodoroId = await createWorkPomodoro(taskId, plannedDurationMs, state.cycleIndex);
    const now = Date.now();
    const from = state.phase;

    state = {
      phase: 'work',
      pomodoroId,
      taskId,
      startedAt: now,
      plannedDurationMs,
      cycleIndex: state.cycleIndex,
      distractionCountSession: 0,
    };

    await cacheTaskInfo(taskId);
    await persist();
    await scheduleTransitionAlarm(now + plannedDurationMs);

    const today = dayKey(now);
    await deps.noteSvc.add({
      day: today,
      kind: 'auto',
      text: `Started pomodoro for task ${taskId}`,
    });

    broadcast({ type: 'pomodoro.state_change', from, to: 'work', at: now });
    broadcast({
      type: 'pomodoro.started',
      phase: 'work',
      startedAt: now,
      plannedDurationMs,
      taskId,
    });
  }

  async function startBreak(kind: 'short_break' | 'long_break', plannedDurationMs: number): Promise<void> {
    const taskId = state.taskId;
    if (!taskId) return;

    const pomodoroId = await createBreakPomodoro(taskId, kind, plannedDurationMs, state.cycleIndex);
    const now = Date.now();
    const from = state.phase;

    state = {
      phase: kind,
      pomodoroId,
      taskId,
      startedAt: now,
      plannedDurationMs,
      cycleIndex: state.cycleIndex,
      distractionCountSession: 0,
    };

    await persist();
    await scheduleTransitionAlarm(now + plannedDurationMs);

    broadcast({ type: 'pomodoro.state_change', from, to: kind, at: now });
    broadcast({
      type: 'pomodoro.started',
      phase: kind,
      startedAt: now,
      plannedDurationMs,
      taskId,
    });
  }

  async function completeWork(): Promise<void> {
    const settings = await getSettings();
    const pomodoroId = state.pomodoroId;
    const taskId = state.taskId;

    if (!pomodoroId || !taskId) return;

    await finishPomodoro(true);
    broadcast({ type: 'pomodoro.completed', pomodoroId, taskId });

    const breakKind = nextBreakKind(state.cycleIndex, settings.longBreakEvery);
    const nextCycleIndex = state.cycleIndex >= settings.longBreakEvery ? 1 : state.cycleIndex + 1;
    state.cycleIndex = nextCycleIndex;

    if (settings.autoStartBreaks) {
      const breakMs = breakKind === 'long_break' ? settings.longBreakMs : settings.shortBreakMs;
      await startBreak(breakKind, breakMs);
    } else {
      await clearTransitionAlarm();
      await transitionTo('idle');
      await resetToIdle();
    }
  }

  async function completeBreak(): Promise<void> {
    const settings = await getSettings();

    await finishPomodoro(true);
    await clearTransitionAlarm();

    if (settings.autoStartNextWork && state.taskId) {
      const workMs = settings.workMs;
      await startWork(state.taskId, workMs);
    } else {
      await transitionTo('idle');
      await resetToIdle();
    }
  }

  async function doCancel(): Promise<void> {
    const pomodoroId = state.pomodoroId;
    if (!pomodoroId) return;

    await finishPomodoro(false);
    broadcast({ type: 'pomodoro.cancelled', pomodoroId });

    await clearTransitionAlarm();
    await transitionTo('idle');
    await resetToIdle();
  }

  return {
    async hydrate() {
      const loaded = await loadEngineState(deps.fastStorage, deps.db);
      if (loaded) {
        state = loaded;
        if (state.taskId) {
          await cacheTaskInfo(state.taskId);
        }
      }
    },

    async recover() {
      if (state.phase === 'idle') return;

      const elapsed = Date.now() - (state.startedAt ?? 0);

      if (elapsed >= state.plannedDurationMs) {
        try {
          await this.handleCompletion();
        } catch {
          await transitionTo('idle');
          await resetToIdle();
        }
        return;
      }

      await scheduleTransitionAlarm((state.startedAt ?? 0) + state.plannedDurationMs);
    },

    async start(taskId) {
      if (state.phase !== 'idle') {
        return { ok: false, error: 'busy' };
      }

      const task = await deps.db.tasks.get(taskId);
      if (!task) {
        return { ok: false, error: 'task_not_found' };
      }

      const settings = await getSettings();
      await startWork(taskId, settings.workMs);

      return {
        ok: true,
        phase: state.phase,
        startedAt: state.startedAt ?? 0,
        plannedDurationMs: state.plannedDurationMs,
      };
    },

    async cancel() {
      if (state.phase === 'idle') return;
      await doCancel();
    },

    async skipBreak() {
      if (state.phase !== 'short_break' && state.phase !== 'long_break') {
        return { ok: false, error: 'not_in_break' };
      }
      await finishPomodoro(false);
      await clearTransitionAlarm();

      const settings = await getSettings();
      if (settings.autoStartNextWork && state.taskId) {
        const workMs = settings.workMs;
        await startWork(state.taskId, workMs);
      } else {
        await transitionTo('idle');
        await resetToIdle();
      }

      return { ok: true };
    },

    async handleCompletion() {
      if (state.phase === 'work') {
        await completeWork();
      } else if (state.phase === 'short_break' || state.phase === 'long_break') {
        await completeBreak();
      }
    },

    async handleDailyReset() {
      state.cycleIndex = 1;
      await persist();
    },

    async getTick(): Promise<Tick> {
      return {
        phase: state.phase,
        remainingMs: remainingMs(state),
        pomodoroId: state.pomodoroId,
        plannedDurationMs: state.plannedDurationMs,
        task: cachedTaskInfo,
        cycleIndex: state.cycleIndex,
        distractionCountSession: state.distractionCountSession,
      };
    },

    recordDistraction(pomodoroId) {
      if (state.pomodoroId === pomodoroId && state.phase === 'work') {
        state.distractionCountSession += 1;
      }
    },

    currentPhase() {
      return state.phase;
    },

    currentPomodoroId() {
      return state.pomodoroId;
    },
  };
}

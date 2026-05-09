import { NotFoundError } from '@/shared/errors';
import { dayKey } from '@/shared/time';
import type { DB } from '@/shared/database/types';
import type { Task } from '@/modules/task/domain/types';
import type { Project } from '@/modules/project/domain/types';
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
  cancel(): Promise<{ ok: boolean }>;
  skipBreak(): Promise<{ ok: true } | { ok: false; error: string }>;
  handleCompletion(): Promise<void>;
  handleDailyReset(): Promise<void>;
  getTick(): Promise<Tick>;
  recordDistraction(pomodoroId: string): void;
  invalidateSettings(): void;
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
  let cachedSettings: typeof DEFAULT_SETTINGS_SNAPSHOT | null = null;

  function getCachedSettings() {
    return cachedSettings ?? DEFAULT_SETTINGS_SNAPSHOT;
  }

  async function getSettings() {
    if (cachedSettings) return cachedSettings;
    try {
      cachedSettings = await deps.settingsSvc.get();
      return cachedSettings;
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

  async function cacheTaskInfo(task: Task, projects: Project[]): Promise<void> {
    const project = projects.find((p) => p.id === task.projectId);
    cachedTaskInfo = {
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      projectName: project?.name ?? '(unknown)',
      projectColor: project?.color ?? 'red',
    };
  }

  async function fetchProjects(): Promise<Project[]> {
    return deps.db.projects.list({ includeArchived: true });
  }

  async function createWorkPomodoro(task: Task, plannedDurationMs: number, cycleIndex: number): Promise<string> {
    const pomodoro = await deps.pomodoroSvc.start({
      taskId: task.id,
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

  async function finishPomodoro(completedFully: boolean): Promise<boolean> {
    if (!state.pomodoroId) return false;
    try {
      await deps.pomodoroSvc.finish(state.pomodoroId, completedFully, state.distractionCountSession);
      return true;
    } catch {
      return false;
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

  async function addAutoNote(text: string): Promise<void> {
    try {
      await deps.noteSvc.add({ day: dayKey(Date.now()), kind: 'auto', text });
    } catch {
      // Best-effort: auto-notes are non-critical
    }
  }

  async function startWork(task: Task, plannedDurationMs: number): Promise<void> {
    if (task.status === 'todo') {
      await deps.taskSvc.setStatus(task.id, 'doing');
    }

    const pomodoroId = await createWorkPomodoro(task, plannedDurationMs, state.cycleIndex);
    const now = Date.now();
    const from = state.phase;

    state = {
      phase: 'work',
      pomodoroId,
      taskId: task.id,
      startedAt: now,
      plannedDurationMs,
      cycleIndex: state.cycleIndex,
      distractionCountSession: 0,
    };

    const projects = await fetchProjects();
    await cacheTaskInfo(task, projects);

    await addAutoNote(`Started pomodoro for task ${task.id}`);

    await Promise.all([
      persist(),
      scheduleTransitionAlarm(now + plannedDurationMs),
    ]);

    broadcast({ type: 'pomodoro.state_change', from, to: 'work', at: now });
    broadcast({
      type: 'pomodoro.started',
      phase: 'work',
      startedAt: now,
      plannedDurationMs,
      taskId: task.id,
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

    await addAutoNote(`Started ${kind} break`);

    await Promise.all([
      persist(),
      scheduleTransitionAlarm(now + plannedDurationMs),
    ]);

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

    const finished = await finishPomodoro(true);
    if (!finished) {
      await clearTransitionAlarm();
      await transitionTo('idle');
      await resetToIdle();
      return;
    }

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
      const task = await deps.db.tasks.get(state.taskId);
      if (task) {
        await startWork(task, workMs);
        return;
      }
    }
    await transitionTo('idle');
    await resetToIdle();
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
          const task = await deps.db.tasks.get(state.taskId);
          if (task) {
            const projects = await fetchProjects();
            await cacheTaskInfo(task, projects);
          }
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
      await startWork(task, settings.workMs);

      return {
        ok: true,
        phase: state.phase,
        startedAt: state.startedAt ?? 0,
        plannedDurationMs: state.plannedDurationMs,
      };
    },

    async cancel() {
      if (state.phase === 'idle') return { ok: false };
      await doCancel();
      return { ok: true };
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
        const task = await deps.db.tasks.get(state.taskId);
        if (task) {
          await startWork(task, workMs);
          return { ok: true };
        }
      }
      await transitionTo('idle');
      await resetToIdle();

      return { ok: true };
    },

    async handleCompletion() {
      if (state.phase === 'work') {
        await completeWork();
      } else if (state.phase === 'short_break' || state.phase === 'long_break') {
        await completeBreak();
      } else {
        await transitionTo('idle');
        await resetToIdle();
      }
    },

    async handleDailyReset() {
      state.cycleIndex = 1;
      await persist();
    },

    invalidateSettings() {
      cachedSettings = null;
      getSettings().catch(() => {});
    },

    async getTick(): Promise<Tick> {
      return {
        phase: state.phase,
        remainingMs: remainingMs(state),
        pomodoroId: state.pomodoroId,
        plannedDurationMs: state.plannedDurationMs,
        task: cachedTaskInfo,
        cycleIndex: state.cycleIndex,
        longBreakEvery: getCachedSettings().longBreakEvery,
        distractionCountSession: state.distractionCountSession,
      };
    },

    recordDistraction(pomodoroId) {
      if (state.pomodoroId === pomodoroId && state.phase === 'work') {
        state.distractionCountSession += 1;
        persist().catch(() => {});
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

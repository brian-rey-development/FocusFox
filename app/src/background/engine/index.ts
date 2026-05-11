import { DEFAULT_SETTINGS } from '@/shared/constants';
import type { Tick, TickTaskInfo, EnginePhase, Deps } from './types';
import { loadEngineState, saveEngineState } from './persistence';
import { defaultState, remainingMs } from './state';
import { createTransitions } from './transitions';
import type { TransitionHelpers } from './transitions';

const POMODORO_TRANSITION_ALARM = 'pomodoro_transition';
const { allowlist: _, ...DEFAULT_SETTINGS_SNAPSHOT } = DEFAULT_SETTINGS;
export { DEFAULT_SETTINGS_SNAPSHOT };

export interface PomodoroEngine {
  hydrate(): Promise<void>;
  recover(): Promise<void>;
  start(taskId: string): Promise<{ ok: true; phase: EnginePhase; startedAt: number; plannedDurationMs: number } | { ok: false; error: string }>;
  cancel(): Promise<{ ok: boolean }>;
  skipBreak(): Promise<{ ok: true } | { ok: false; error: string }>;
  handleCompletion(): Promise<void>;
  handleDailyReset(): Promise<void>;
  getTick(): Promise<Tick>;
  recordDistraction(pomodoroId: string): Promise<void>;
  invalidateSettings(): void;
  currentPhase(): EnginePhase;
  currentPomodoroId(): string | null;
}

export function createPomodoroEngine(deps: Deps): PomodoroEngine {
  let state = defaultState();
  let cachedTaskInfo: TickTaskInfo | null = null;
  let cachedSettings: typeof DEFAULT_SETTINGS_SNAPSHOT | null = null;
  let transitioning = false;

  function logCatch(context: string, e: unknown) {
    console.warn(`[FocusFox] engine: ${context}:`, e);
  }

  function getCachedSettings() {
    return cachedSettings ?? DEFAULT_SETTINGS_SNAPSHOT;
  }

  async function getSettings() {
    if (cachedSettings) return cachedSettings;
    try {
      cachedSettings = await deps.settingsSvc.get();
      return cachedSettings;
    } catch (e) {
      logCatch('getSettings', e);
      return DEFAULT_SETTINGS_SNAPSHOT;
    }
  }

  async function persist(): Promise<void> {
    await saveEngineState(deps.fastStorage, deps.db, { ...state });
  }

  async function clearTransitionAlarm(): Promise<void> {
    await deps.alarmManager.clear(POMODORO_TRANSITION_ALARM);
  }

  async function scheduleTransitionAlarm(when: number): Promise<void> {
    await deps.alarmManager.schedule(POMODORO_TRANSITION_ALARM, when);
  }

  function broadcast(event: Parameters<Deps['eventEmitter']['broadcast']>[0]): void {
    deps.eventEmitter.broadcast(event);
  }

  const helpers: TransitionHelpers = {
    getState: () => state,
    setState: (s) => { state = s; },
    getCachedTaskInfo: () => cachedTaskInfo,
    setCachedTaskInfo: (info) => { cachedTaskInfo = info; },
    getSettings,
    persist,
    clearTransitionAlarm,
    scheduleTransitionAlarm,
    broadcast,
  };

  const transitions = createTransitions(deps, helpers);

  return {
    async hydrate() {
      const loaded = await loadEngineState(deps.fastStorage, deps.db);
      if (loaded) {
        state = loaded;
        if (state.taskId) {
          const task = await deps.db.tasks.get(state.taskId);
          if (task) {
            const projects = await deps.db.projects.list({ includeArchived: true });
            await transitions.cacheTaskInfo(task, projects);
          }
        }
      }
    },

    async recover() {
      if (state.phase === 'idle') return;
      if (state.startedAt === null) {
        console.error('[FocusFox] engine: corrupt state - non-idle with null startedAt. Resetting.');
        helpers.setState(defaultState());
        helpers.setCachedTaskInfo(null);
        await persist();
        return;
      }

      const elapsed = Date.now() - state.startedAt;

      if (elapsed >= state.plannedDurationMs) {
        try {
          await this.handleCompletion();
        } catch (e) {
          logCatch('recover handleCompletion', e);
          helpers.setState(defaultState());
          helpers.setCachedTaskInfo(null);
          await persist();
        }
        return;
      }

      await scheduleTransitionAlarm(state.startedAt + state.plannedDurationMs);
    },

    async start(taskId) {
      transitioning = true;
      try {
        if (state.phase !== 'idle') {
          return { ok: false as const, error: 'busy' };
        }

        const task = await deps.db.tasks.get(taskId);
        if (!task) {
          return { ok: false as const, error: 'task_not_found' };
        }

        const settings = await getSettings();
        await transitions.startWork(task, settings.workMs);

        return {
          ok: true as const,
          phase: state.phase,
          startedAt: state.startedAt ?? 0,
          plannedDurationMs: state.plannedDurationMs,
        };
      } finally {
        transitioning = false;
      }
    },

    async cancel() {
      transitioning = true;
      try {
        if (state.phase === 'idle') return { ok: false as const, error: 'not_running' };
        await transitions.doCancel();
        return { ok: true as const };
      } finally {
        transitioning = false;
      }
    },

    async skipBreak() {
      transitioning = true;
      try {
        if (state.phase !== 'short_break' && state.phase !== 'long_break') {
          return { ok: false as const, error: 'not_in_break' };
        }
        await transitions.finishPomodoro(false);

        const settings = await getSettings();
        if (settings.autoStartNextWork && state.taskId) {
          const workMs = settings.workMs;
          try {
            const task = await deps.db.tasks.get(state.taskId);
            if (task) {
              await transitions.startWork(task, workMs);
              return { ok: true as const };
            }
          } catch (e) {
            logCatch('skipBreak db.tasks.get', e);
          }
        }

        const from = state.phase;
        await transitions.transitionToIdle(from);

        return { ok: true as const };
      } finally {
        transitioning = false;
      }
    },

    async handleCompletion() {
      if (transitioning) return;
      transitioning = true;
      try {
        if (state.phase === 'work') {
          await transitions.completeWork();
        } else if (state.phase === 'short_break' || state.phase === 'long_break') {
          await transitions.completeBreak();
        } else {
          helpers.setState(defaultState());
          helpers.setCachedTaskInfo(null);
          await persist();
        }
      } finally {
        transitioning = false;
      }
    },

    async handleDailyReset() {
      if (transitioning) return;
      transitioning = true;
      try {
        helpers.setState({ ...state, cycleIndex: 1 });
        await persist();
      } finally {
        transitioning = false;
      }
    },

    invalidateSettings() {
      cachedSettings = null;
      getSettings().catch((e) => logCatch('invalidateSettings prefetch', e));
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

    async recordDistraction(pomodoroId) {
      if (transitioning) return;
      transitioning = true;
      try {
        if (state.pomodoroId === pomodoroId && state.phase === 'work') {
          helpers.setState({ ...state, distractionCountSession: state.distractionCountSession + 1 });
          await persist();
        }
      } finally {
        transitioning = false;
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

import type { Task } from '@/modules/task/domain/types';
import type { Project } from '@/modules/project/domain/types';
import type { EngineState, EnginePhase, TickTaskInfo, PomodoroEvent, Deps } from './types';
import { cloneState, nextBreakKind } from './state';
import { dayKey } from '@/shared/time';
import { NotFoundError } from '@/shared/errors';

export interface EngineSettings {
  workMs: number;
  shortBreakMs: number;
  longBreakMs: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartNextWork: boolean;
}

export interface TransitionHelpers {
  getState(): EngineState;
  setState(s: EngineState): void;
  getCachedTaskInfo(): TickTaskInfo | null;
  setCachedTaskInfo(info: TickTaskInfo | null): void;
  getSettings(): Promise<EngineSettings>;
  persist(): Promise<void>;
  clearTransitionAlarm(): Promise<void>;
  scheduleTransitionAlarm(when: number): Promise<void>;
  broadcast(event: PomodoroEvent): void;
}

export function createTransitions(deps: Deps, h: TransitionHelpers) {
  async function fetchProjects(): Promise<Project[]> {
    return deps.db.projects.list({ includeArchived: true });
  }

  async function cacheTaskInfo(task: Task, projects: Project[]): Promise<void> {
    const project = projects.find((p) => p.id === task.projectId);
    h.setCachedTaskInfo({
      id: task.id,
      title: task.title,
      projectId: task.projectId,
      projectName: project?.name ?? '(unknown)',
      projectColor: project?.color ?? 'red',
    });
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

  async function createBreakPomodoro(
    taskId: string,
    kind: 'short_break' | 'long_break',
    plannedDurationMs: number,
    cycleIndex: number,
  ): Promise<string> {
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

  async function addAutoNote(text: string): Promise<void> {
    try {
      await deps.noteSvc.add({ day: dayKey(Date.now()), kind: 'auto', text });
    } catch (e) {
      console.warn('[FocusFox] engine: addAutoNote:', e);
    }
  }

  async function transitionTo(next: EnginePhase): Promise<void> {
    const state = h.getState();
    const from = state.phase;
    const clone = cloneState(state);
    clone.phase = next;
    h.setState(clone);
    await h.persist();
    h.broadcast({ type: 'pomodoro.state_change', from, to: next, at: Date.now() });
  }

  async function resetToIdle(): Promise<void> {
    const state = h.getState();
    state.pomodoroId = null;
    state.taskId = null;
    state.startedAt = null;
    state.plannedDurationMs = 0;
    state.distractionCountSession = 0;
    h.setCachedTaskInfo(null);
    await h.persist();
  }

  async function finishPomodoro(completedFully: boolean): Promise<boolean> {
    const state = h.getState();
    if (!state.pomodoroId) return false;
    try {
      await deps.pomodoroSvc.finish(state.pomodoroId, completedFully, state.distractionCountSession);
      return true;
    } catch (e) {
      console.warn('[FocusFox] engine: finishPomodoro:', e);
      return false;
    }
  }

  async function startWork(task: Task, plannedDurationMs: number): Promise<void> {
    const cycleIndex = h.getState().cycleIndex;
    if (task.status === 'todo') {
      await deps.taskSvc.setStatus(task.id, 'doing');
    }

    const pomodoroId = await createWorkPomodoro(task, plannedDurationMs, cycleIndex);
    const now = Date.now();
    const from = h.getState().phase;

    h.setState({
      phase: 'work',
      pomodoroId,
      taskId: task.id,
      startedAt: now,
      plannedDurationMs,
      cycleIndex,
      distractionCountSession: 0,
    });

    const projects = await fetchProjects();
    await cacheTaskInfo(task, projects);
    await addAutoNote(`Started pomodoro for task ${task.id}`);

    await Promise.all([
      h.persist(),
      h.scheduleTransitionAlarm(now + plannedDurationMs),
    ]);

    h.broadcast({ type: 'pomodoro.state_change', from, to: 'work', at: now });
    h.broadcast({
      type: 'pomodoro.started',
      phase: 'work',
      startedAt: now,
      plannedDurationMs,
      taskId: task.id,
    });
  }

  async function startBreak(kind: 'short_break' | 'long_break', plannedDurationMs: number): Promise<void> {
    const taskId = h.getState().taskId;
    if (!taskId) return;

    const pomodoroId = await createBreakPomodoro(taskId, kind, plannedDurationMs, h.getState().cycleIndex);
    const now = Date.now();
    const from = h.getState().phase;

    h.setState({
      phase: kind,
      pomodoroId,
      taskId,
      startedAt: now,
      plannedDurationMs,
      cycleIndex: h.getState().cycleIndex,
      distractionCountSession: 0,
    });

    await addAutoNote(`Started ${kind} break`);

    await Promise.all([
      h.persist(),
      h.scheduleTransitionAlarm(now + plannedDurationMs),
    ]);

    h.broadcast({ type: 'pomodoro.state_change', from, to: kind, at: now });
    h.broadcast({
      type: 'pomodoro.started',
      phase: kind,
      startedAt: now,
      plannedDurationMs,
      taskId,
    });
  }

  async function completeWork(): Promise<void> {
    const settings = await h.getSettings();
    const state = h.getState();
    const pomodoroId = state.pomodoroId;
    const taskId = state.taskId;

    if (!pomodoroId || !taskId) return;

    const finished = await finishPomodoro(true);
    if (!finished) {
      await h.clearTransitionAlarm();
      await transitionTo('idle');
      await resetToIdle();
      return;
    }

    h.broadcast({ type: 'pomodoro.completed', pomodoroId, taskId });

    const breakKind = nextBreakKind(state.cycleIndex, settings.longBreakEvery);
    const nextCycleIndex = state.cycleIndex >= settings.longBreakEvery ? 1 : state.cycleIndex + 1;
    const clone = cloneState(state);
    clone.cycleIndex = nextCycleIndex;
    h.setState(clone);

    if (settings.autoStartBreaks) {
      const breakMs = breakKind === 'long_break' ? settings.longBreakMs : settings.shortBreakMs;
      await startBreak(breakKind, breakMs);
    } else {
      await h.clearTransitionAlarm();
      await transitionTo('idle');
      await resetToIdle();
    }
  }

  async function completeBreak(): Promise<void> {
    const settings = await h.getSettings();

    await finishPomodoro(true);
    await h.clearTransitionAlarm();

    if (settings.autoStartNextWork && h.getState().taskId) {
      const workMs = settings.workMs;
      const task = await deps.db.tasks.get(h.getState().taskId!);
      if (task) {
        await startWork(task, workMs);
        return;
      }
    }
    await transitionTo('idle');
    await resetToIdle();
  }

  async function doCancel(): Promise<void> {
    const state = h.getState();
    const pomodoroId = state.pomodoroId;
    if (!pomodoroId) return;

    await finishPomodoro(false);
    h.broadcast({ type: 'pomodoro.cancelled', pomodoroId });

    await h.clearTransitionAlarm();
    await transitionTo('idle');
    await resetToIdle();
  }

  return { startWork, completeWork, startBreak, completeBreak, doCancel, finishPomodoro, cacheTaskInfo, fetchProjects };
}

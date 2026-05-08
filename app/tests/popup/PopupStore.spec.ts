import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePopupStore } from '../../src/popup/PopupStore';
import type { TickPayload, ActivePomodoro } from '../../src/popup/PopupStore';
import type { Project } from '../../src/modules/project/domain/types';
import type { Task } from '../../src/modules/task/domain/types';

function mockRuntime() {
  const sendMessage = vi.fn();
  const disconnect = vi.fn();
  const port = {
    name: 'popup',
    postMessage: vi.fn(),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    onDisconnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    disconnect,
  } as unknown as browser.runtime.Port;

  const runtime = {
    sendMessage,
    connect: vi.fn(() => port),
    onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    onConnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
  } as unknown as typeof browser.runtime;

  globalThis.browser = { runtime } as unknown as typeof browser;

  return { sendMessage, port, disconnect };
}

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj-1',
    name: 'Test Project',
    color: 'orange',
    createdAt: 1000,
    archived: false,
    ...overrides,
  };
}

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 'task-1',
    projectId: 'proj-1',
    title: 'Test Task',
    status: 'todo',
    estimatedPomodoros: 3,
    completedPomodoros: 0,
    createdAt: 1000,
    updatedAt: 1000,
    doneAt: null,
    ...overrides,
  };
}

function makeTickPayload(overrides: Partial<TickPayload> = {}): TickPayload {
  return {
    now: 5000,
    active: {
      id: 'pomo-1',
      kind: 'work',
      startedAt: 1000,
      plannedDurationMs: 1500000,
      distractionCount: 2,
      taskId: 'task-1',
      projectId: 'proj-1',
    },
    ...overrides,
  };
}

function makeActivePomodoro(overrides: Partial<ActivePomodoro> = {}): ActivePomodoro {
  return {
    id: 'pomo-1',
    kind: 'work',
    remainingMs: 1496000,
    plannedDurationMs: 1500000,
    distractionCount: 2,
    taskId: 'task-1',
    projectId: 'proj-1',
    ...overrides,
  };
}

describe('PopupStore', () => {
  beforeEach(() => {
    usePopupStore.setState({
      phase: 'loading',
      projects: [],
      tasks: [],
      selectedTaskId: null,
      estimateDraft: 1,
      showManualInput: false,
      showCancelConfirm: false,
      error: null,
      active: null,
    });
    mockRuntime();
  });

  describe('initial state', () => {
    it('starts in loading phase', () => {
      const state = usePopupStore.getState();
      expect(state.phase).toBe('loading');
      expect(state.active).toBeNull();
      expect(state.error).toBeNull();
    });
  });

  describe('selectTask', () => {
    it('sets selectedTaskId and updates estimateDraft from task', () => {
      const task = makeTask({ estimatedPomodoros: 5 });
      usePopupStore.setState({ tasks: [task] });

      usePopupStore.getState().selectTask(task.id);

      const state = usePopupStore.getState();
      expect(state.selectedTaskId).toBe(task.id);
      expect(state.estimateDraft).toBe(5);
    });

    it('defaults estimateDraft to 1 when task has no estimate', () => {
      const task = makeTask({ estimatedPomodoros: null });
      usePopupStore.setState({ tasks: [task] });

      usePopupStore.getState().selectTask(task.id);

      expect(usePopupStore.getState().estimateDraft).toBe(1);
    });
  });

  describe('setEstimateDraft', () => {
    it('clamps value between 1 and 20', () => {
      const store = usePopupStore.getState();
      store.setEstimateDraft(0);
      expect(usePopupStore.getState().estimateDraft).toBe(1);

      store.setEstimateDraft(21);
      expect(usePopupStore.getState().estimateDraft).toBe(20);

      store.setEstimateDraft(10);
      expect(usePopupStore.getState().estimateDraft).toBe(10);
    });
  });

  describe('applyTick', () => {
    it('sets active and transitions to active phase for work kind', () => {
      const tick = makeTickPayload({ active: { ...makeTickPayload().active!, kind: 'work' } });
      usePopupStore.setState({ phase: 'idle' });

      usePopupStore.getState().applyTick(tick);

      const state = usePopupStore.getState();
      expect(state.phase).toBe('active');
      expect(state.active).not.toBeNull();
      expect(state.active!.kind).toBe('work');
      expect(state.active!.remainingMs).toBe(1000 + 1500000 - 5000);
    });

    it('transitions to break phase for short_break kind', () => {
      const tick = makeTickPayload({ active: { ...makeTickPayload().active!, kind: 'short_break' } });

      usePopupStore.getState().applyTick(tick);

      expect(usePopupStore.getState().phase).toBe('break');
    });

    it('transitions to break phase for long_break kind', () => {
      const tick = makeTickPayload({ active: { ...makeTickPayload().active!, kind: 'long_break' } });

      usePopupStore.getState().applyTick(tick);

      expect(usePopupStore.getState().phase).toBe('break');
    });

    it('transitions to idle when active becomes null', () => {
      usePopupStore.setState({ phase: 'active', active: makeActivePomodoro() });

      usePopupStore.getState().applyTick({ now: 6000, active: null });

      expect(usePopupStore.getState().phase).toBe('idle');
      expect(usePopupStore.getState().active).toBeNull();
    });

    it('does not transition from loading when tick has no active', () => {
      usePopupStore.setState({ phase: 'loading' });

      usePopupStore.getState().applyTick({ now: 6000, active: null });

      expect(usePopupStore.getState().phase).toBe('loading');
    });
  });

  describe('setShowManualInput / setShowCancelConfirm', () => {
    it('toggles showManualInput', () => {
      usePopupStore.getState().setShowManualInput(true);
      expect(usePopupStore.getState().showManualInput).toBe(true);

      usePopupStore.getState().setShowManualInput(false);
      expect(usePopupStore.getState().showManualInput).toBe(false);
    });

    it('toggles showCancelConfirm', () => {
      usePopupStore.getState().setShowCancelConfirm(true);
      expect(usePopupStore.getState().showCancelConfirm).toBe(true);
    });
  });

  describe('startPomodoro', () => {
    it('sends pomodoro:start message and does not throw when no task selected', async () => {
      usePopupStore.setState({ selectedTaskId: null });

      await expect(usePopupStore.getState().startPomodoro()).resolves.toBeUndefined();
    });

    it('sends task:update for estimate if different from task value', async () => {
      const mock = mockRuntime();
      mock.sendMessage.mockResolvedValueOnce(undefined);
      mock.sendMessage.mockResolvedValueOnce({ workMs: 1500000 });
      mock.sendMessage.mockResolvedValueOnce(undefined);

      usePopupStore.setState({
        tasks: [makeTask({ id: 'task-1', estimatedPomodoros: 3 })],
        projects: [makeProject()],
        selectedTaskId: 'task-1',
        estimateDraft: 5,
      });

      await usePopupStore.getState().startPomodoro();

      expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'task:update', payload: { id: 'task-1', patch: { estimatedPomodoros: 5 } } });
    });

    it('sends pomodoro:start with correct payload', async () => {
      const mock = mockRuntime();
      mock.sendMessage.mockResolvedValueOnce({ workMs: 1500000 });
      mock.sendMessage.mockResolvedValueOnce(undefined);

      usePopupStore.setState({
        tasks: [makeTask({ id: 'task-1', estimatedPomodoros: 3 })],
        projects: [makeProject()],
        selectedTaskId: 'task-1',
        estimateDraft: 3,
      });

      await usePopupStore.getState().startPomodoro();

      expect(mock.sendMessage).toHaveBeenCalledWith({
        type: 'pomodoro:start',
        payload: {
          taskId: 'task-1',
          projectId: 'proj-1',
          kind: 'work',
          plannedDurationMs: 1500000,
          cycleIndex: 0,
        },
      });
    });
  });

  describe('cancelPomodoro', () => {
    it('sends pomodoro:cancel and transitions to idle', async () => {
      const mock = mockRuntime();
      mock.sendMessage.mockResolvedValue(undefined);

      usePopupStore.setState({
        phase: 'active',
        active: makeActivePomodoro(),
      });

      await usePopupStore.getState().cancelPomodoro();

      expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'pomodoro:cancel', payload: { id: 'pomo-1' } });
      const state = usePopupStore.getState();
      expect(state.phase).toBe('idle');
      expect(state.active).toBeNull();
      expect(state.showCancelConfirm).toBe(false);
    });
  });

  describe('skipBreak', () => {
    it('sends pomodoro:skipBreak and transitions to idle', async () => {
      const mock = mockRuntime();
      mock.sendMessage.mockResolvedValue(undefined);

      usePopupStore.setState({
        phase: 'break',
        active: makeActivePomodoro({ kind: 'short_break' }),
      });

      await usePopupStore.getState().skipBreak();

      expect(mock.sendMessage).toHaveBeenCalledWith({ type: 'pomodoro:skipBreak', payload: { id: 'pomo-1' } });
      expect(usePopupStore.getState().phase).toBe('idle');
    });
  });

  describe('recordDistraction', () => {
    it('sends distraction:record with reason and hides input', async () => {
      const mock = mockRuntime();
      mock.sendMessage.mockResolvedValue(undefined);

      usePopupStore.setState({
        active: makeActivePomodoro(),
      });

      await usePopupStore.getState().recordDistraction('got distracted');

      expect(mock.sendMessage).toHaveBeenCalledWith({
        type: 'distraction:record',
        payload: {
          pomodoroId: 'pomo-1',
          type: 'manual',
          reason: 'got distracted',
        },
      });
      expect(usePopupStore.getState().showManualInput).toBe(false);
    });

    it('sends distraction:record without reason when none given', async () => {
      const mock = mockRuntime();
      mock.sendMessage.mockResolvedValue(undefined);

      usePopupStore.setState({
        active: makeActivePomodoro(),
      });

      await usePopupStore.getState().recordDistraction();

      expect(mock.sendMessage).toHaveBeenCalledWith({
        type: 'distraction:record',
        payload: {
          pomodoroId: 'pomo-1',
          type: 'manual',
          reason: undefined,
        },
      });
    });

    it('does nothing when no active pomodoro', async () => {
      const mock = mockRuntime();

      await expect(usePopupStore.getState().recordDistraction()).resolves.toBeUndefined();
      expect(mock.sendMessage).not.toHaveBeenCalled();
    });
  });

  describe('setError', () => {
    it('sets error and transitions to error phase', () => {
      usePopupStore.getState().setError('Something broke');

      const state = usePopupStore.getState();
      expect(state.error).toBe('Something broke');
      expect(state.phase).toBe('error');
    });

    it('clears error without changing phase when msg is null', () => {
      usePopupStore.setState({ error: 'old error', phase: 'active' });

      usePopupStore.getState().setError(null);

      expect(usePopupStore.getState().error).toBeNull();
      expect(usePopupStore.getState().phase).toBe('active');
    });
  });

  describe('retry', () => {
    it('resets to loading and calls init', async () => {
      const initSpy = vi.spyOn(usePopupStore.getState(), 'init');
      initSpy.mockResolvedValue(undefined);

      usePopupStore.setState({ phase: 'error', error: 'fail' });

      await usePopupStore.getState().retry();

      expect(usePopupStore.getState().phase).toBe('loading');
      expect(usePopupStore.getState().error).toBeNull();
    });
  });
});

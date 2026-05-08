import { create } from 'zustand';
import { sendMessage } from '@/shared/messages';
import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';
import type { PomodoroKind } from '@/modules/pomodoro/domain/types';

export interface TickPayload {
  now: number;
  active: {
    id: string;
    kind: PomodoroKind;
    startedAt: number;
    plannedDurationMs: number;
    distractionCount: number;
    taskId: string;
    projectId: string;
  } | null;
}

export interface ActivePomodoro {
  id: string;
  kind: PomodoroKind;
  remainingMs: number;
  plannedDurationMs: number;
  distractionCount: number;
  taskId: string;
  projectId: string;
}

export type Phase = 'loading' | 'idle' | 'active' | 'break' | 'error';

export interface PopupState {
  phase: Phase;
  projects: Project[];
  tasks: Task[];
  selectedTaskId: string | null;
  estimateDraft: number;
  showManualInput: boolean;
  showCancelConfirm: boolean;
  error: string | null;
  active: ActivePomodoro | null;
}

interface PopupActions {
  init: () => Promise<void>;
  applyTick: (data: TickPayload) => void;
  selectTask: (taskId: string) => void;
  setEstimateDraft: (n: number) => void;
  setShowManualInput: (v: boolean) => void;
  setShowCancelConfirm: (v: boolean) => void;
  startPomodoro: () => Promise<void>;
  cancelPomodoro: () => Promise<void>;
  skipBreak: () => Promise<void>;
  recordDistraction: (reason?: string) => Promise<void>;
  setError: (msg: string | null) => void;
  retry: () => Promise<void>;
}

function computeActive(tick: TickPayload): ActivePomodoro | null {
  if (!tick.active) return null;
  return {
    ...tick.active,
    remainingMs: Math.max(0, tick.active.startedAt + tick.active.plannedDurationMs - tick.now),
  };
}

export const usePopupStore = create<PopupState & PopupActions>((set, get) => ({
  phase: 'loading',
  projects: [],
  tasks: [],
  selectedTaskId: null,
  estimateDraft: 1,
  showManualInput: false,
  showCancelConfirm: false,
  error: null,
  active: null,

  async init() {
    try {
      const [projects, activePomodoro] = await Promise.all([
        sendMessage<Project[]>('project:list'),
        sendMessage<{ id: string; kind: PomodoroKind; startedAt: number; plannedDurationMs: number; distractionCount: number; taskId: string; projectId: string } | null>('pomodoro:getActive'),
      ]);

      const projectsList = projects as Project[];

      set({
        projects: projectsList,
        phase: activePomodoro ? (activePomodoro.kind === 'work' ? 'active' : 'break') : 'idle',
        selectedTaskId: null,
        estimateDraft: 1,
        showManualInput: false,
        showCancelConfirm: false,
        error: null,
      });

      const nonArchived = projectsList.filter((p) => !p.archived);
      if (nonArchived.length > 0) {
        const allTasks = await Promise.all(
          nonArchived.map((p) => sendMessage<Task[]>('task:list', { projectId: p.id })),
        );
        const tasksList = allTasks.flat().filter((t) => t.status !== 'done');
        const firstTask = tasksList[0] ?? null;
        set({
          tasks: tasksList,
          selectedTaskId: firstTask?.id ?? null,
          estimateDraft: firstTask?.estimatedPomodoros ?? 1,
        });
      }

      if (activePomodoro) {
        const now = Date.now();
        set({
          active: {
            ...activePomodoro,
            remainingMs: Math.max(0, activePomodoro.startedAt + activePomodoro.plannedDurationMs - now),
          },
        });
      }
    } catch {
      set({ phase: 'error', error: 'Failed to initialize' });
    }
  },

  applyTick(data) {
    const active = computeActive(data);
    const state = get();

    if (active) {
      const phase = active.kind === 'work' ? 'active' : 'break';
      const taskChanged = active.taskId !== state.active?.taskId;

      set({ active, phase, error: null });

      if (taskChanged || state.tasks.length === 0) {
        const project = state.projects.find((p) => p.id === active.projectId);
        if (project) {
          sendMessage<Task[]>('task:list', { projectId: active.projectId }).then((tasks) => {
            const t = Array.isArray(tasks) ? tasks.filter((x) => x.status !== 'done') : [];
            set({ tasks: t });
          }).catch(() => {});
        }
      }
    } else {
      if (state.phase !== 'loading' && state.phase !== 'error') {
        set({ active: null, phase: 'idle' });
      }
    }
  },

  selectTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    set({
      selectedTaskId: taskId,
      estimateDraft: task?.estimatedPomodoros ?? 1,
    });
  },

  setEstimateDraft(n) {
    set({ estimateDraft: Math.max(1, Math.min(20, n)) });
  },

  setShowManualInput(v) {
    set({ showManualInput: v });
  },

  setShowCancelConfirm(v) {
    set({ showCancelConfirm: v });
  },

  async startPomodoro() {
    const { selectedTaskId, estimateDraft, projects } = get();
    if (!selectedTaskId) return;

    const task = get().tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    const project = projects.find((p) => p.id === task.projectId);
    if (!project) return;

    try {
      if (task.estimatedPomodoros !== estimateDraft) {
        sendMessage('task:update', { id: selectedTaskId, patch: { estimatedPomodoros: estimateDraft } }).catch(() => {});
      }

      const settings = await sendMessage<{ workMs: number }>('settings:get');
      const workMs = settings.workMs ?? 25 * 60_000;

      await sendMessage('pomodoro:start', {
        taskId: selectedTaskId,
        projectId: task.projectId,
        kind: 'work',
        plannedDurationMs: workMs,
        cycleIndex: 0,
      });
    } catch {
      set({ error: 'Failed to start pomodoro' });
    }
  },

  async cancelPomodoro() {
    const { active } = get();
    if (!active) return;

    try {
      await sendMessage('pomodoro:cancel', { id: active.id });
      set({
        phase: 'idle',
        active: null,
        showCancelConfirm: false,
        showManualInput: false,
      });
    } catch {
      set({ error: 'Failed to cancel pomodoro' });
    }
  },

  async skipBreak() {
    const { active } = get();
    if (!active) return;

    try {
      await sendMessage('pomodoro:skipBreak', { id: active.id });
      set({ active: null, phase: 'idle' });
    } catch {
      set({ error: 'Failed to skip break' });
    }
  },

  async recordDistraction(reason?: string) {
    const { active } = get();
    if (!active) return;

    try {
      await sendMessage('distraction:record', {
        pomodoroId: active.id,
        type: 'manual',
        reason: reason || undefined,
      });
      set({ showManualInput: false });
    } catch {
      set({ error: 'Failed to record distraction' });
    }
  },

  setError(msg) {
    set({ error: msg, phase: msg ? 'error' : get().phase });
  },

  async retry() {
    set({ phase: 'loading', error: null });
    await get().init();
  },
}));

import { create } from 'zustand';
import { sendMessage } from '@/shared/messages';
import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';
import type { EnginePhase } from '@/background/engine/types';

export interface TickPayload {
  phase: EnginePhase;
  remainingMs: number;
  pomodoroId: string | null;
  plannedDurationMs: number;
  task: { id: string; title: string; projectId: string; projectName: string; projectColor: string } | null;
  cycleIndex: number;
  distractionCountSession: number;
}

export interface ActivePomodoro {
  id: string;
  kind: EnginePhase;
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
  applyEvent: (event: { type: string }) => void;
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

function phaseFromEngine(enginePhase: EnginePhase): Phase {
  if (enginePhase === 'idle') return 'idle';
  if (enginePhase === 'work') return 'active';
  return 'break';
}

function buildActive(tick: TickPayload): ActivePomodoro | null {
  if (!tick.pomodoroId) return null;
  return {
    id: tick.pomodoroId,
    kind: tick.phase,
    remainingMs: tick.remainingMs,
    plannedDurationMs: tick.plannedDurationMs,
    distractionCount: tick.distractionCountSession,
    taskId: tick.task?.id ?? '',
    projectId: tick.task?.projectId ?? '',
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
      const [projects, tick] = await Promise.all([
        sendMessage<Project[]>('project:list'),
        sendMessage<TickPayload>('pomodoro:snapshot'),
      ]);

      const projectsList = projects as Project[];
      const tickData = tick as TickPayload;

      set({
        projects: projectsList,
        phase: phaseFromEngine(tickData.phase),
        selectedTaskId: null,
        estimateDraft: 1,
        showManualInput: false,
        showCancelConfirm: false,
        error: null,
        active: buildActive(tickData),
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
    } catch {
      set({ phase: 'error', error: 'Failed to initialize' });
    }
  },

  applyTick(data) {
    const active = buildActive(data);
    const state = get();

    if (active) {
      const phase = phaseFromEngine(data.phase);
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

  applyEvent(event) {
    if (event.type === 'pomodoro.state_change') {
      const state = get();
      if (state.phase !== 'loading' && state.phase !== 'error') {
        // Phase will be updated on next tick; no immediate action needed
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
    const { selectedTaskId, estimateDraft } = get();
    if (!selectedTaskId) return;

    const task = get().tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    try {
      if (task.estimatedPomodoros !== estimateDraft) {
        sendMessage('task:update', { id: selectedTaskId, patch: { estimatedPomodoros: estimateDraft } }).catch(() => {});
      }

      await sendMessage('pomodoro:start', { taskId: selectedTaskId });
    } catch {
      set({ error: 'Failed to start pomodoro' });
    }
  },

  async cancelPomodoro() {
    try {
      await sendMessage('pomodoro:cancel');
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
    try {
      await sendMessage('pomodoro:skipBreak');
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

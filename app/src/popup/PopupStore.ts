import { create } from 'zustand';
import { sendMessage } from '@/shared/messages';
import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';
import type { Tick as TickPayload, EnginePhase } from '@/shared/engine-types';

export type { TickPayload };

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
  error: string | null;
  active: ActivePomodoro | null;
}

interface PopupActions {
  init: () => Promise<void>;
  applyTick: (data: TickPayload) => void;
  applyEvent: (event: { type: string }) => void;
  selectTask: (taskId: string) => void;
  setEstimateDraft: (n: number) => void;
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

let taskRefreshing = false;

export const usePopupStore = create<PopupState & PopupActions>((set, get) => ({
  phase: 'loading',
  projects: [],
  tasks: [],
  selectedTaskId: null,
  estimateDraft: 1,
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
        error: null,
        active: buildActive(tickData),
      });

      const nonArchived = projectsList.filter((p) => !p.archived);
      if (nonArchived.length > 0) {
        const allTasks = await sendMessage<Task[]>('task:listAll', {
          projectIds: nonArchived.map((p) => p.id),
        });
        const tasksList = allTasks.filter((t) => t.status !== 'done');
        const firstTask = tasksList[0] ?? null;
        set({
          tasks: tasksList,
          selectedTaskId: firstTask?.id ?? null,
          estimateDraft: firstTask?.estimatedPomodoros ?? 1,
        });
      }
    } catch (e) {
      console.error('[FocusFox]', e);
      set({ phase: 'error', error: 'No se pudo inicializar' });
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
        if (project && !taskRefreshing) {
          taskRefreshing = true;
          sendMessage<Task[]>('task:list', { projectId: active.projectId }).then((tasks) => {
            const activeTasks = Array.isArray(tasks) ? tasks.filter((task) => task.status !== 'done') : [];
            set({ tasks: activeTasks });
          }).catch((e) => {
            console.error('[FocusFox]', e);
            set({ phase: 'error', error: 'No se pudieron cargar las tareas' });
          }).finally(() => {
            taskRefreshing = false;
          });
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
      const stateChange = event as unknown as { from: EnginePhase; to: EnginePhase; at: number };
      set({ phase: phaseFromEngine(stateChange.to) });
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

  async startPomodoro() {
    const { selectedTaskId, estimateDraft } = get();
    if (!selectedTaskId) return;

    const task = get().tasks.find((t) => t.id === selectedTaskId);
    if (!task) return;

    try {
      if (task.estimatedPomodoros !== estimateDraft) {
        sendMessage('task:update', { id: selectedTaskId, patch: { estimatedPomodoros: estimateDraft } }).catch((e) => { console.error('[FocusFox]', e); });
      }

      await sendMessage('pomodoro:start', { taskId: selectedTaskId });
    } catch (e) {
      console.error('[FocusFox]', e);
      set({ phase: 'error', error: 'No se pudo iniciar el pomodoro' });
    }
  },

  async cancelPomodoro() {
    try {
      await sendMessage('pomodoro:cancel');
    } catch (e) {
      console.error('[FocusFox]', e);
      set({ phase: 'error', error: 'No se pudo cancelar el pomodoro' });
    }
  },

  async skipBreak() {
    try {
      await sendMessage('pomodoro:skipBreak');
      set({ active: null, phase: 'idle' });
    } catch (e) {
      console.error('[FocusFox]', e);
      set({ phase: 'error', error: 'No se pudo saltar el descanso' });
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
    } catch (e) {
      console.error('[FocusFox]', e);
      set({ phase: 'error', error: 'No se pudo registrar la distracción' });
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

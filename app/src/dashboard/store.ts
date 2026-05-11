import { create } from 'zustand';
import type { Tick } from '@/shared/engine-types';
import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';
import type { NoteEntry } from '@/modules/note/domain/types';
import type { Settings } from '@/modules/settings/domain/types';
import type { StatsSummary } from '@/modules/stats/domain/types';
import type { Tab } from './hooks/useHashRoute';

export interface Toast {
  id: string;
  message: string;
  kind: 'success' | 'error' | 'info';
}

export interface DashState {
  tab: Tab;
  tick: Tick | null;
  projects: Project[];
  selectedProjectId: string | null;
  tasksByProject: Record<string, Task[]>;
  notesByDay: Record<string, NoteEntry[]>;
  statsCache: StatsSummary | null;
  settings: Settings | null;
  toasts: Toast[];
}

interface DashActions {
  setTab: (tab: Tab) => void;
  setTick: (tick: Tick | null) => void;
  setProjects: (projects: Project[]) => void;
  setSelectedProject: (id: string | null) => void;
  setTasksForProject: (projectId: string, tasks: Task[]) => void;
  setNotesForDay: (day: string, notes: NoteEntry[]) => void;
  setStatsCache: (summary: StatsSummary | null) => void;
  setSettings: (settings: Settings) => void;
  pushToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
}

export type DashStore = DashState & DashActions;

let toastCounter = 0;

export const useDashStore = create<DashStore>((set) => ({
  tab: 'hoy',
  tick: null,
  projects: [],
  selectedProjectId: null,
  tasksByProject: {},
  notesByDay: {},
  statsCache: null,
  settings: null,
  toasts: [],

  setTab: (tab) => set({ tab }),
  setTick: (tick) => set({ tick }),
  setProjects: (projects) => set({ projects }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),
  setTasksForProject: (projectId, tasks) =>
    set((s) => ({ tasksByProject: { ...s.tasksByProject, [projectId]: tasks } })),
  setNotesForDay: (day, notes) =>
    set((s) => ({ notesByDay: { ...s.notesByDay, [day]: notes } })),
  setStatsCache: (summary) => set({ statsCache: summary }),
  setSettings: (settings) => set({ settings }),
  pushToast: (toast) =>
    set((s) => ({
      toasts: [
        ...s.toasts.slice(-2),
        { ...toast, id: `toast-${++toastCounter}` },
      ],
    })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

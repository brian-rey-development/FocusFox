import type { DBSchema, IDBPDatabase } from 'idb';
import type { Distraction } from '@/modules/distraction/domain/types';
import type { MetaRow } from '@/modules/meta/domain/types';
import type { NoteEntry } from '@/modules/note/domain/types';
import type { Pomodoro } from '@/modules/pomodoro/domain/types';
import type { Project } from '@/modules/project/domain/types';
import type { Settings } from '@/modules/settings/domain/types';
import type { Task } from '@/modules/task/domain/types';
import type { DistractionRepo } from '@/modules/distraction/domain/interfaces';
import type { MetaRepo } from '@/modules/meta/domain/interfaces';
import type { NoteRepo } from '@/modules/note/domain/interfaces';
import type { PomodoroRepo } from '@/modules/pomodoro/domain/interfaces';
import type { ProjectRepo } from '@/modules/project/domain/interfaces';
import type { SettingsRepo } from '@/modules/settings/domain/interfaces';
import type { TaskRepo } from '@/modules/task/domain/interfaces';

type Indexes<T extends Record<string, IDBValidKey>> = T & { [k: string]: IDBValidKey };

export interface FocusFoxDB extends DBSchema {
  'projects': {
    key: string;
    value: Project;
    indexes: Indexes<{ 'by_archived': number }>;
  };
  'tasks': {
    key: string;
    value: Task;
    indexes: Indexes<{
      'by_project': string;
      'by_status': Task['status'];
    }>;
  };
  'pomodoros': {
    key: string;
    value: Pomodoro;
    indexes: Indexes<{
      'by_task': string;
      'by_project': string;
      'by_started': number;
      'by_day': string;
    }>;
  };
  'distractions': {
    key: string;
    value: Distraction;
    indexes: Indexes<{
      'by_pomodoro': string;
      'by_at': number;
    }>;
  };
  'notes': {
    key: string;
    value: NoteEntry;
    indexes: Indexes<{
      'by_day': string;
      'by_at': number;
    }>;
  };
  'settings': {
    key: string;
    value: Settings;
  };
  'meta': {
    key: string;
    value: MetaRow;
  };
}

export interface DB {
  close: () => void;
  resetAllData: () => Promise<void>;
  raw: IDBPDatabase<FocusFoxDB>;
  projects: ProjectRepo;
  tasks: TaskRepo;
  pomodoros: PomodoroRepo;
  distractions: DistractionRepo;
  notes: NoteRepo;
  settings: SettingsRepo;
  meta: MetaRepo;
}

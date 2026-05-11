import { useState, useEffect, useCallback, forwardRef, useImperativeHandle, useRef } from 'react';
import { sendMessage } from '@/shared/messages';
import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';
import type { Tick } from '@/shared/engine-types';
import { useDashStore } from '../store';
import { ProjectHeader } from '../components/ProjectHeader';
import { NewTaskInput } from '../components/NewTaskInput';
import { TaskRow } from '../components/TaskRow';

interface TasksViewProps {
  project: Project | null;
  tick: Tick | null;
}

export const TasksView = forwardRef<{ focusInput: () => void }, TasksViewProps>(function TasksView({ project, tick }, ref) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const pushToast = useDashStore((s) => s.pushToast);
  const inputRef = useRef<HTMLInputElement>(null);

  useImperativeHandle(ref, () => ({
    focusInput: () => inputRef.current?.focus(),
  }));

  const fetchTasks = useCallback(async () => {
    if (!project) return;
    try {
      const data = await sendMessage<Task[]>('task:list', { projectId: project.id });
      setTasks(data);
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudieron cargar las tareas', kind: 'error' });
    }
  }, [project, pushToast]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  if (!project) {
    return (
      <div className="dashboard-empty">
        <p>Seleccioná un proyecto en la barra lateral o creá uno nuevo.</p>
      </div>
    );
  }

  const doneCount = tasks.filter((t) => t.status === 'done').length;
  const activeTasks = tasks.filter((t) => t.status !== 'done').sort((a, b) => a.createdAt - b.createdAt);
  const doneTasks = tasks.filter((t) => t.status === 'done').sort((a, b) => a.createdAt - b.createdAt);

  async function handleCreateTask(title: string) {
    try {
      const created = await sendMessage<Task>('task:create', { projectId: project!.id, title });
      setTasks((prev) => [...prev, created]);
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo crear la tarea', kind: 'error' });
    }
  }

  async function handleToggleDone(task: Task) {
    try {
      const newStatus = task.status === 'done' ? 'todo' : 'done';
      await sendMessage('task:setStatus', { id: task.id, status: newStatus });
      await fetchTasks();
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo actualizar la tarea', kind: 'error' });
    }
  }

  async function handleDeleteTask(taskId: string) {
    try {
      await sendMessage('task:delete', { id: taskId });
      await fetchTasks();
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo eliminar la tarea', kind: 'error' });
    }
  }

  async function handleRenameTask(taskId: string, title: string) {
    try {
      await sendMessage('task:update', { id: taskId, patch: { title } });
      await fetchTasks();
    } catch (e) {
      console.error('[FocusFox]', e);
      pushToast({ message: 'No se pudo renombrar la tarea', kind: 'error' });
    }
  }

  return (
    <div className="tasks-view">
      <ProjectHeader project={project} totalTasks={tasks.length} doneTasks={doneCount} />
      <NewTaskInput onSubmit={handleCreateTask} ref={inputRef} />
      <div className="tasks-view__list">
        {activeTasks.map((t) => (
          <TaskRow
            key={t.id}
            task={t}
            isActive={tick?.task?.id === t.id}
            onToggleDone={() => handleToggleDone(t)}
            onDelete={() => handleDeleteTask(t.id)}
            onRename={(title) => handleRenameTask(t.id, title)}
          />
        ))}
        {activeTasks.length === 0 && !project.archived && (
          <p className="tasks-view__empty">Aún no hay tareas en este proyecto. Creá una arriba.</p>
        )}
        {doneTasks.length > 0 && (
          <>
            <div className="tasks-view__separator" />
            {doneTasks.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                isActive={false}
                onToggleDone={() => handleToggleDone(t)}
                onDelete={() => handleDeleteTask(t.id)}
                onRename={(title) => handleRenameTask(t.id, title)}
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
});

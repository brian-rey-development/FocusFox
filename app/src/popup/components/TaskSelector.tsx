import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';

interface TaskSelectorProps {
  projects: Project[];
  tasks: Task[];
  selectedTaskId: string | null;
  onSelectTask: (taskId: string) => void;
}

export function TaskSelector({ projects, tasks, selectedTaskId, onSelectTask }: TaskSelectorProps) {
  const nonArchived = projects.filter((p) => !p.archived);

  const handleOpenDashboard = () => {
    void browser.tabs.create({ url: browser.runtime.getURL('src/dashboard/index.html') });
  };

  if (nonArchived.length === 0) {
    return (
      <div className="popup-task-selector">
        <span className="popup-label">Tarea</span>
        <p className="popup-task-selector__empty">
          <button className="popup-task-selector__link-btn" onClick={handleOpenDashboard}>
            Creá un proyecto desde el panel
          </button>
        </p>
      </div>
    );
  }

  const hasActiveTasks = tasks.length > 0;

  if (!hasActiveTasks) {
    return (
      <div className="popup-task-selector">
        <span className="popup-label">Tarea</span>
        <p className="popup-task-selector__empty">
          <button className="popup-task-selector__link-btn" onClick={handleOpenDashboard}>
            + nueva tarea
          </button>
        </p>
      </div>
    );
  }

  return (
    <div className="popup-task-selector">
      <label className="popup-label" htmlFor="task-select">Tarea</label>
      <select
        id="task-select"
        value={selectedTaskId ?? ''}
        onChange={(e) => onSelectTask(e.target.value)}
      >
        {nonArchived.map((project) => {
          const projectTasks = tasks.filter((t) => t.projectId === project.id);
          if (projectTasks.length === 0) return null;
          return (
            <optgroup key={project.id} label={project.name}>
              {projectTasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </optgroup>
          );
        })}
      </select>
    </div>
  );
}

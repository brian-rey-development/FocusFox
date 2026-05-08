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

  if (nonArchived.length === 0) {
    return (
      <div className="popup-task-selector">
        <span className="popup-label">Task</span>
        <p className="popup-task-selector__empty">
          <a href="#">Create a project from the dashboard</a>
        </p>
      </div>
    );
  }

  const hasActiveTasks = tasks.length > 0;

  if (!hasActiveTasks) {
    return (
      <div className="popup-task-selector">
        <span className="popup-label">Task</span>
        <p className="popup-task-selector__empty">
          <a href="#">+ new task</a>
        </p>
      </div>
    );
  }

  return (
    <div className="popup-task-selector">
      <label className="popup-label" htmlFor="task-select">Task</label>
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

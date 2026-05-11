import type { ProjectColor } from '@/modules/project/domain/types';
import { PROJECT_COLOR_HEX } from '@/modules/project/domain/types';

interface TaskCardProps {
  taskTitle: string | null;
  projectName: string | null;
  projectColor: ProjectColor | null;
}

export function TaskCard({ taskTitle, projectName, projectColor }: TaskCardProps) {
  if (!taskTitle) {
    return (
      <div className="popup-task-card">
        <span className="popup-task-card__placeholder">Sin tarea</span>
      </div>
    );
  }

  return (
    <div className="popup-task-card">
      {projectColor && (
        <span
          className="popup-task-card__color-dot"
          style={{ background: PROJECT_COLOR_HEX[projectColor] }}
          aria-hidden="true"
        />
      )}
      <div className="popup-task-card__info">
        {projectName && (
          <div className="popup-task-card__project">{projectName}</div>
        )}
        <div className="popup-task-card__title">{taskTitle}</div>
      </div>
    </div>
  );
}

import type { Project } from '@/modules/project/domain/types';
import { PROJECT_COLOR_HEX } from '@/modules/project/domain/types';

interface ProjectHeaderProps {
  project: Project;
  totalTasks: number;
  doneTasks: number;
}

export function ProjectHeader({ project, totalTasks, doneTasks }: ProjectHeaderProps) {
  return (
    <div className="project-header">
      <span
        className="project-header__dot"
        style={{ backgroundColor: PROJECT_COLOR_HEX[project.color] }}
        aria-hidden="true"
      />
      <h2 className="project-header__name">{project.name}</h2>
      <span className="project-header__count">
        {doneTasks}/{totalTasks} tareas
      </span>
    </div>
  );
}

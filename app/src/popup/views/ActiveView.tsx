import { usePopupStore, type ActivePomodoro } from '../PopupStore';
import type { Project } from '@/modules/project/domain/types';
import type { Task } from '@/modules/task/domain/types';
import { Ring } from '../components/Ring';
import { TaskCard } from '../components/TaskCard';
import { DistractionRow } from '../components/DistractionRow';
import { ManualDistractionInput } from '../components/ManualDistractionInput';
import { Actions } from '../components/Actions';
import { CancelConfirm } from '../components/CancelConfirm';

const noop = () => {};

function findTask(tasks: Task[], active: ActivePomodoro): Task | undefined {
  return tasks.find((t) => t.id === active.taskId);
}

function findProject(projects: Project[], active: ActivePomodoro): Project | undefined {
  return projects.find((p) => p.id === active.projectId);
}

export function ActiveView() {
  const active = usePopupStore((s) => s.active) as ActivePomodoro;
  const tasks = usePopupStore((s) => s.tasks);
  const projects = usePopupStore((s) => s.projects);
  const showManualInput = usePopupStore((s) => s.showManualInput);
  const showCancelConfirm = usePopupStore((s) => s.showCancelConfirm);
  const setShowManualInput = usePopupStore((s) => s.setShowManualInput);
  const setShowCancelConfirm = usePopupStore((s) => s.setShowCancelConfirm);
  const recordDistraction = usePopupStore((s) => s.recordDistraction);
  const cancelPomodoro = usePopupStore((s) => s.cancelPomodoro);

  const task = findTask(tasks, active);
  const project = findProject(projects, active);

  return (
    <div className="popup-content__scroll">
      <Ring
        remainingMs={active.remainingMs}
        totalMs={active.plannedDurationMs}
        label="trabajando"
      />
      <TaskCard
        taskTitle={task?.title ?? null}
        projectName={project?.name ?? null}
        projectColor={project?.color ?? null}
      />
      <DistractionRow
        count={active.distractionCount}
        onManualClick={() => setShowManualInput(true)}
      />
      {showManualInput && (
        <ManualDistractionInput
          onSubmit={(reason) => recordDistraction(reason)}
          onCancel={() => setShowManualInput(false)}
        />
      )}
      {showCancelConfirm ? (
        <CancelConfirm
          onConfirm={cancelPomodoro}
          onDismiss={() => setShowCancelConfirm(false)}
        />
      ) : (
        <Actions
          kind="active"
          onPrimary={noop}
          onSecondary={() => setShowCancelConfirm(true)}
        />
      )}
    </div>
  );
}

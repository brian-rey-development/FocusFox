import { usePopupStore } from '../PopupStore';
import { TaskSelector } from '../components/TaskSelector';
import { EstimateStepper } from '../components/EstimateStepper';
import { Actions } from '../components/Actions';

export function IdleView() {
  const projects = usePopupStore((s) => s.projects);
  const tasks = usePopupStore((s) => s.tasks);
  const selectedTaskId = usePopupStore((s) => s.selectedTaskId);
  const estimateDraft = usePopupStore((s) => s.estimateDraft);
  const selectTask = usePopupStore((s) => s.selectTask);
  const setEstimateDraft = usePopupStore((s) => s.setEstimateDraft);
  const startPomodoro = usePopupStore((s) => s.startPomodoro);

  return (
    <div className="popup-content__scroll">
      <TaskSelector
        projects={projects}
        tasks={tasks}
        selectedTaskId={selectedTaskId}
        onSelectTask={selectTask}
      />
      <EstimateStepper
        value={estimateDraft}
        onChange={setEstimateDraft}
        min={1}
        max={20}
      />
      <Actions
        kind="idle"
        onPrimary={startPomodoro}
        primaryDisabled={!selectedTaskId}
      />
    </div>
  );
}

import { usePopupStore, type ActivePomodoro } from '../PopupStore';
import { Ring, LABEL_MAP } from '../components/Ring';
import type { PomodoroKind } from '@/modules/pomodoro/domain/types';

export function BreakView() {
  const active = usePopupStore((s) => s.active) as ActivePomodoro;
  const skipBreak = usePopupStore((s) => s.skipBreak);

  return (
    <div className="popup-content__scroll">
      <Ring
        remainingMs={active.remainingMs}
        totalMs={active.plannedDurationMs}
        label={LABEL_MAP[active.kind as PomodoroKind]}
        active={false}
      />
      <button className="popup-break-skip" onClick={skipBreak}>
        Skip break
      </button>
    </div>
  );
}

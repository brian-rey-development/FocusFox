import { usePopupStore } from '../PopupStore';
import { Ring, LABEL_MAP } from '../components/Ring';
import type { PomodoroKind } from '@/modules/pomodoro/domain/types';

export function BreakView() {
  const active = usePopupStore((s) => s.active);
  const skipBreak = usePopupStore((s) => s.skipBreak);

  if (!active) return null;

  return (
    <div className="popup-content__scroll">
      <Ring
        remainingMs={active.remainingMs}
        totalMs={active.plannedDurationMs}
        label={LABEL_MAP[active.kind as PomodoroKind] ?? 'descanso'}
      />
      <button className="popup-break-skip" onClick={skipBreak}>
        Skip break
      </button>
    </div>
  );
}

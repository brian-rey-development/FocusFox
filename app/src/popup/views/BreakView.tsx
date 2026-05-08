import { usePopupStore, type ActivePomodoro } from '../PopupStore';
import { Ring, LABEL_MAP } from '../components/Ring';

export function BreakView() {
  const active = usePopupStore((s) => s.active) as ActivePomodoro;
  const skipBreak = usePopupStore((s) => s.skipBreak);

  return (
    <div className="popup-content__scroll">
      <Ring
        remainingMs={active.remainingMs}
        totalMs={active.plannedDurationMs}
        label={LABEL_MAP[active.kind]}
        active={false}
      />
      <button className="popup-break-skip" onClick={skipBreak}>
        Skip break
      </button>
    </div>
  );
}

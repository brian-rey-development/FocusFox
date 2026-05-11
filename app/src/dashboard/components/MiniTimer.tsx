import { formatMs } from '@/shared/format';
import type { Tick } from '@/shared/engine-types';

interface MiniTimerProps {
  tick: Tick;
  onClick: () => void;
}

export function MiniTimer({ tick, onClick }: MiniTimerProps) {
  return (
    <button className="mini-timer" onClick={onClick} aria-label="Ver pomodoro activo">
      <span className="mini-timer__ring" aria-hidden="true" />
      <span className="mini-timer__time">{formatMs(tick.remainingMs)}</span>
      <span className="mini-timer__label">
        {tick.task?.title ?? 'Pomodoro activo'}
      </span>
    </button>
  );
}

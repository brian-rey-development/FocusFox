import { useRef, useState } from 'react';
import { usePopupStore } from '../PopupStore';
import { Ring, LABEL_MAP } from '../components/Ring';
import type { PomodoroKind } from '@/modules/pomodoro/domain/types';
import type { ActivePomodoro } from '../PopupStore';

export function BreakView() {
  const active = usePopupStore((s) => s.active);
  const skipBreak = usePopupStore((s) => s.skipBreak);
  const [skipping, setSkipping] = useState(false);

  // Cache last valid active state to avoid blank flashes during transitions
  const lastActiveRef = useRef<ActivePomodoro | null>(null);
  if (active !== null) {
    lastActiveRef.current = active;
  }

  const snapshot = active ?? lastActiveRef.current;

  if (!snapshot) return null;

  const handleSkip = async () => {
    if (skipping) return;
    setSkipping(true);
    try {
      await skipBreak();
    } finally {
      setSkipping(false);
    }
  };

  return (
    <div className="popup-content__scroll">
      <Ring
        remainingMs={snapshot.remainingMs}
        totalMs={snapshot.plannedDurationMs}
        label={LABEL_MAP[snapshot.kind as PomodoroKind] ?? 'descanso'}
      />
      <button
        className="popup-break-skip"
        onClick={handleSkip}
        disabled={skipping}
        aria-busy={skipping}
      >
        {skipping ? 'Saltando...' : 'Saltar descanso'}
      </button>
    </div>
  );
}

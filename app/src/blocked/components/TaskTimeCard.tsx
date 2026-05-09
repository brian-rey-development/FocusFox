import { useEffect, useRef, useState } from 'react';
import { PROJECT_COLOR_HEX } from '@/shared/constants';
import type { TaskTimeCardProps } from '../types';
import { formatRemaining } from '../utils';

export function TaskTimeCard({
  task,
  project,
  remainingMs,
  cycleIndex,
  longBreakEvery,
}: TaskTimeCardProps) {
  const hex = PROJECT_COLOR_HEX[project.color] ?? '#e8a44f';
  const display = formatRemaining(remainingMs);
  const currentMinute = Math.floor(remainingMs / 60_000);

  const announcedMinuteRef = useRef<number | null>(null);
  const [shouldAnnounce, setShouldAnnounce] = useState(false);

  useEffect(() => {
    if (announcedMinuteRef.current !== currentMinute) {
      announcedMinuteRef.current = currentMinute;
      setShouldAnnounce(true);
    } else {
      setShouldAnnounce(false);
    }
  }, [currentMinute]);

  return (
    <div className="task-time-card">
      <div className="task-time-card__left">
        <span className="task-time-card__label">Tarea actual</span>
        <span className="task-time-card__title">{task.title}</span>
        <span className="task-time-card__meta">
          <span style={{ color: hex }}>{project.name}</span>
          {' - '}
          {cycleIndex} / {longBreakEvery} pomodoros
        </span>
      </div>
      <div className="task-time-card__right">
        <span
          className="task-time-card__time"
          aria-live={shouldAnnounce ? 'polite' : 'off'}
          aria-atomic={shouldAnnounce ? true : undefined}
        >
          {display}
        </span>
        <span className="task-time-card__time-label">restantes</span>
      </div>
    </div>
  );
}

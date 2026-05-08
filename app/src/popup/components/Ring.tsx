import { formatMs } from '@/shared/format';
import type { PomodoroKind } from '@/modules/pomodoro/domain/types';

interface RingProps {
  remainingMs: number;
  totalMs: number;
  label: string;
  active: boolean;
}

const SIZE = 196;
const STROKE = 5;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CENTER = SIZE / 2;

const LABEL_MAP: Record<PomodoroKind, string> = {
  work: 'trabajando',
  short_break: 'descanso corto',
  long_break: 'descanso largo',
};

export function Ring({ remainingMs, totalMs, label }: RingProps) {
  const progress = totalMs > 0 ? remainingMs / totalMs : 0;
  const dashOffset = CIRCUMFERENCE * (1 - progress);
  const timeStr = formatMs(remainingMs);

  return (
    <div
      className="popup-ring"
      role="timer"
      aria-live="polite"
      aria-label={`${timeStr} remaining, ${label}`}
    >
      <svg
        className="popup-ring__svg"
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ring-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#f5b765" />
            <stop offset="100%" stopColor="#d18a32" />
          </linearGradient>
          <filter id="ring-glow">
            <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="#f5b82e" floodOpacity="0.4" />
          </filter>
        </defs>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="var(--border-color)"
          strokeWidth={STROKE}
        />
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          fill="none"
          stroke="url(#ring-gradient)"
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          filter="url(#ring-glow)"
          style={{ transition: 'stroke-dashoffset 0.3s linear' }}
        />
        <text
          x={CENTER}
          y={CENTER - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-primary)"
          fontSize="32"
          fontWeight="700"
          fontFamily="'JetBrains Mono', 'Inter', monospace"
          style={{ fontFeatureSettings: "'tnum'" } as React.CSSProperties}
        >
          {timeStr}
        </text>
        <text
          x={CENTER}
          y={CENTER + 20}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-tertiary)"
          fontSize="11"
          fontWeight="500"
          fontFamily="var(--font-family)"
        >
          {label}
        </text>
      </svg>
    </div>
  );
}

export { LABEL_MAP };

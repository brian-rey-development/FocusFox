import type { RangeDays } from '@/modules/stats/domain/types';

interface RangeSelectorProps {
  value: RangeDays;
  onChange: (days: RangeDays) => void;
}

const OPTIONS: RangeDays[] = [7, 30, 90, 365];

export function RangeSelector({ value, onChange }: RangeSelectorProps) {
  return (
    <div className="range-selector" role="tablist" aria-label="Rango de fechas">
      {OPTIONS.map((d) => (
        <button
          key={d}
          role="tab"
          aria-selected={value === d}
          className={`range-selector__tab${value === d ? ' range-selector__tab--active' : ''}`}
          onClick={() => onChange(d)}
        >
          {d}d
        </button>
      ))}
    </div>
  );
}

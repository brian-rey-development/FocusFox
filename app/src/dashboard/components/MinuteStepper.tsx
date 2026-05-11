import { clampMinutes } from '../domain';

interface MinuteStepperProps {
  label: string;
  value: number;
  onChange: (minutes: number) => void;
  min: number;
  max: number;
  showSuffix?: boolean;
}

function dynamicStep(value: number): number {
  return value >= 30 ? 5 : 1;
}

export function MinuteStepper({ label, value, onChange, min, max, showSuffix = true }: MinuteStepperProps) {
  const step = dynamicStep(value);

  function handleDecrement() {
    const next = clampMinutes(value - step, min, max);
    if (next !== value) onChange(next);
  }

  function handleIncrement() {
    const next = clampMinutes(value + step, min, max);
    if (next !== value) onChange(next);
  }

  return (
    <div className="minute-stepper">
      <span className="minute-stepper__label">{label}</span>
      <div className="minute-stepper__controls">
        <button
          className="minute-stepper__btn"
          onClick={handleDecrement}
          disabled={value <= min}
          aria-label={`Reducir ${label}`}
        >
          -
        </button>
        <span className="minute-stepper__value">
          {value}{showSuffix ? ' min' : ''}
        </span>
        <button
          className="minute-stepper__btn"
          onClick={handleIncrement}
          disabled={value >= max}
          aria-label={`Aumentar ${label}`}
        >
          +
        </button>
      </div>
    </div>
  );
}

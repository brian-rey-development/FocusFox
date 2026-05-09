import { Minus, Plus } from 'lucide-react';

interface EstimateStepperProps {
  value: number;
  onChange: (n: number) => void;
  min: number;
  max: number;
}

export function EstimateStepper({ value, onChange, min, max }: EstimateStepperProps) {
  return (
    <div className="popup-estimate">
      <span className="popup-label">Pomodoros</span>
      <div className="popup-estimate__row">
        <button
          className="popup-estimate__btn"
          onClick={() => onChange(value - 1)}
          disabled={value <= min}
          aria-label="Reducir estimación"
        >
          <Minus size={16} aria-hidden="true" />
        </button>
        <span className="popup-estimate__value">{value}</span>
        <button
          className="popup-estimate__btn"
          onClick={() => onChange(value + 1)}
          disabled={value >= max}
          aria-label="Aumentar estimación"
        >
          <Plus size={16} aria-hidden="true" />
        </button>
        <span className="popup-estimate__unit">pomodoro{value !== 1 ? 's' : ''}</span>
      </div>
    </div>
  );
}

import { AlertTriangle } from 'lucide-react';

interface DistractionRowProps {
  count: number;
  onManualClick: () => void;
}

export function DistractionRow({ count, onManualClick }: DistractionRowProps) {
  return (
    <div className="popup-distraction">
      <span className="popup-distraction__count">
        <AlertTriangle className="popup-distraction__count-icon" aria-hidden="true" />
        {count}
      </span>
      <button className="popup-distraction__btn" onClick={onManualClick}>
        Me distraje
      </button>
    </div>
  );
}

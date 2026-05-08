import { AlertCircle } from 'lucide-react';

interface ErrorViewProps {
  message: string;
  onRetry: () => void;
}

export function ErrorView({ message, onRetry }: ErrorViewProps) {
  return (
    <div className="popup-error">
      <AlertCircle className="popup-error__icon" aria-hidden="true" />
      <p className="popup-error__message">{message}</p>
      <button className="popup-error__btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}

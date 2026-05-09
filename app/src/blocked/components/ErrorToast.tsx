import type { ErrorToastProps } from '../types';

export function ErrorToast({ onRetry }: ErrorToastProps) {
  return (
    <div className="error-toast">
      <span className="error-toast__text">
        No se pudo contactar al motor. Intentá de nuevo.
      </span>
      <button className="error-toast__btn" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

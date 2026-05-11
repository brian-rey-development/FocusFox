import { useState } from 'react';
import { useBlockedStore } from '../store';
import type { CancelLinkProps } from '../types';

export function CancelLink({ onCancel }: CancelLinkProps) {
  const [loading, setLoading] = useState(false);
  const confirmCancel = useBlockedStore((s) => s.confirmCancel);
  const setConfirmCancel = useBlockedStore((s) => s.setConfirmCancel);

  function handleClick() {
    setConfirmCancel(true);
  }

  async function handleConfirm() {
    setLoading(true);
    try {
      await onCancel();
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function handleDismiss() {
    setConfirmCancel(false);
  }

  return (
    <div className="cancel-link">
      {!confirmCancel ? (
        <button className="cancel-link__btn" onClick={handleClick}>
          cancelar pomodoro y desbloquear</button>
      ) : (
        <div className="cancel-link__confirm">
          <span className="cancel-link__confirm-text">
            ¿Seguro? Vas a perder este pomodoro.
          </span>
          <div className="cancel-link__confirm-actions">
            <button className="cancel-link__confirm-yes" onClick={handleConfirm} disabled={loading}>
              {loading ? 'Cancelando...' : 'Sí, cancelar pomodoro y desbloquear'}
            </button>
            <button className="cancel-link__confirm-no" onClick={handleDismiss}>
              Volver
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

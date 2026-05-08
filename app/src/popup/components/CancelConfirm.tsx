interface CancelConfirmProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

export function CancelConfirm({ onConfirm, onDismiss }: CancelConfirmProps) {
  return (
    <div className="popup-cancel-confirm" role="alertdialog" aria-label="Cancel pomodoro confirmation">
      <p className="popup-cancel-confirm__text">
        Cancel pomodoro? It will be recorded as incomplete.
      </p>
      <div className="popup-cancel-confirm__actions">
        <button className="popup-cancel-confirm__confirm" onClick={onConfirm}>
          Yes, cancel
        </button>
        <button className="popup-cancel-confirm__dismiss" onClick={onDismiss}>
          No, continue
        </button>
      </div>
    </div>
  );
}

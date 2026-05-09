interface CancelConfirmProps {
  onConfirm: () => void;
  onDismiss: () => void;
}

export function CancelConfirm({ onConfirm, onDismiss }: CancelConfirmProps) {
  return (
    <div className="popup-cancel-confirm" role="alertdialog" aria-label="Confirmar cancelación de pomodoro">
      <p className="popup-cancel-confirm__text">
        ¿Cancelar pomodoro? Se registrará como incompleto.
      </p>
      <div className="popup-cancel-confirm__actions">
        <button className="popup-cancel-confirm__confirm" onClick={onConfirm}>
          Sí, cancelar
        </button>
        <button className="popup-cancel-confirm__dismiss" onClick={onDismiss}>
          No, continuar
        </button>
      </div>
    </div>
  );
}

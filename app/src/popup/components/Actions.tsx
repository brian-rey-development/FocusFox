interface ActionsProps {
  kind: 'idle' | 'active';
  onPrimary: () => void;
  onSecondary?: () => void;
  primaryDisabled?: boolean;
}

export function Actions({ kind, onPrimary, onSecondary, primaryDisabled }: ActionsProps) {
  if (kind === 'idle') {
    return (
      <div className="popup-actions">
        <button
          className="popup-actions__primary"
          onClick={onPrimary}
          disabled={primaryDisabled}
        >
          Start pomodoro
        </button>
      </div>
    );
  }

  return (
    <div className="popup-actions">
      {onSecondary && (
        <button className="popup-actions__secondary" onClick={onSecondary}>
          Cancel
        </button>
      )}
    </div>
  );
}

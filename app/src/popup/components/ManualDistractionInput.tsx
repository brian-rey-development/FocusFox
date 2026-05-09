import { useState, useRef, useEffect } from 'react';

interface ManualDistractionInputProps {
  onSubmit: (reason: string | undefined) => void;
  onCancel: () => void;
}

export function ManualDistractionInput({ onSubmit, onCancel }: ManualDistractionInputProps) {
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit() {
    onSubmit(reason.trim() || undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleSubmit();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className="popup-manual-input">
      <input
        ref={inputRef}
        className="popup-manual-input__field"
        type="text"
        placeholder="Motivo (opcional)"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Motivo de distracción"
      />
      <div className="popup-manual-input__actions">
        <button className="popup-manual-input__submit" onClick={handleSubmit}>
          Registrar
        </button>
        <button className="popup-manual-input__cancel" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

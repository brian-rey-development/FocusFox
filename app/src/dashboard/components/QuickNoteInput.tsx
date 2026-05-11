import { useState, forwardRef } from 'react';
import { Send } from 'lucide-react';

const MAX_CHARS = 1000;

interface QuickNoteInputProps {
  onSubmit: (text: string) => void;
}

export const QuickNoteInput = forwardRef<HTMLInputElement, QuickNoteInputProps>(
  function QuickNoteInput({ onSubmit }, ref) {
    const [value, setValue] = useState('');

    function handleSubmit() {
      const trimmed = value.trim();
      if (!trimmed) return;
      onSubmit(trimmed);
      setValue('');
    }

    const nearLimit = value.length > MAX_CHARS * 0.9;

    return (
      <div className="quick-note-input">
        <div className="quick-note-input__row">
          <input
            ref={ref}
            className="quick-note-input__field"
            type="text"
            placeholder="Agregar nota... usa #etiquetas"
            value={value}
            maxLength={MAX_CHARS}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
            }}
          />
          <button
            className="quick-note-input__send"
            onClick={handleSubmit}
            disabled={!value.trim()}
            aria-label="Enviar nota"
          >
            <Send size={15} />
          </button>
        </div>
        <div className="quick-note-input__meta">
          <span className="quick-note-input__hint">Usa #etiquetas para categorizar</span>
          {value.length > 0 && (
            <span className={`quick-note-input__counter${nearLimit ? ' quick-note-input__counter--warn' : ''}`}>
              {value.length} / {MAX_CHARS}
            </span>
          )}
        </div>
      </div>
    );
  }
);

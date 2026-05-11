import { useState, forwardRef } from 'react';

interface QuickNoteInputProps {
  onSubmit: (text: string) => void;
}

export const QuickNoteInput = forwardRef<HTMLInputElement, QuickNoteInputProps>(function QuickNoteInput({ onSubmit }, ref) {
  const [value, setValue] = useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="quick-note-input">
      <input
        ref={ref}
        className="quick-note-input__field"
        type="text"
        placeholder="Agregar nota..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
      />
    </div>
  );
});

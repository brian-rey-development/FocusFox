import { useState, forwardRef } from 'react';
import { Plus } from 'lucide-react';

interface NewTaskInputProps {
  onSubmit: (title: string) => void;
}

export const NewTaskInput = forwardRef<HTMLInputElement, NewTaskInputProps>(function NewTaskInput({ onSubmit }, ref) {
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      await onSubmit(trimmed);
      setValue('');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="new-task-input">
      <button className="new-task-input__icon" onClick={handleSubmit} aria-label="Crear tarea" disabled={saving}>
        <Plus size={16} aria-hidden="true" />
      </button>
      <input
        ref={ref}
        className="new-task-input__field"
        type="text"
        placeholder="Nueva tarea..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
        }}
        disabled={saving}
      />
    </div>
  );
});

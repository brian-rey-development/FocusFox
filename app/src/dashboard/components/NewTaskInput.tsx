import { useState, forwardRef } from 'react';
import { Plus } from 'lucide-react';

interface NewTaskInputProps {
  onSubmit: (title: string) => void;
}

export const NewTaskInput = forwardRef<HTMLInputElement, NewTaskInputProps>(function NewTaskInput({ onSubmit }, ref) {
  const [value, setValue] = useState('');

  function handleSubmit() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="new-task-input">
      <button className="new-task-input__icon" onClick={handleSubmit} aria-label="Crear tarea">
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
      />
    </div>
  );
});

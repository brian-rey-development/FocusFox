import { useState, useEffect, memo } from 'react';
import { Check } from 'lucide-react';
import type { Task } from '@/modules/task/domain/types';
import { PomoDots } from './PomoDots';
import { TaskMenu } from './TaskMenu';

interface TaskRowProps {
  task: Task;
  isActive: boolean;
  onToggleDone: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}

export const TaskRow = memo(function TaskRow({ task, isActive, onToggleDone, onDelete, onRename }: TaskRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);

  useEffect(() => {
    if (!editing) setDraft(task.title);
  }, [task.title, editing]);

  function handleRename() {
    setDraft(task.title);
    setEditing(true);
  }

  function handleSubmitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== task.title) {
      onRename(trimmed);
    }
    setEditing(false);
  }

  const done = task.status === 'done';

  return (
    <div className={`task-row${done ? ' task-row--done' : ''}${isActive ? ' task-row--active' : ''}`}>
      <button
        className="task-row__check"
        onClick={onToggleDone}
        aria-label={done ? 'Marcar como pendiente' : 'Marcar como completada'}
      >
        {done ? <Check size={14} aria-hidden="true" /> : <span className="task-row__check-empty" aria-hidden="true" />}
      </button>

      <div className="task-row__body">
        {editing ? (
          <input
            className="task-row__edit-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={handleSubmitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmitRename();
              if (e.key === 'Escape') setEditing(false);
            }}
            autoFocus
          />
        ) : (
          <span className="task-row__title">{task.title}</span>
        )}
        <div className="task-row__meta">
          <PomoDots completed={task.completedPomodoros} estimated={task.estimatedPomodoros} />
          {isActive && <span className="task-row__active-badge">En curso</span>}
        </div>
      </div>

      <TaskMenu onRename={handleRename} onDelete={onDelete} />
    </div>
  );
});

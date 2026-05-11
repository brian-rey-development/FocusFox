import { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, Pencil, Trash2 } from 'lucide-react';

interface TaskMenuProps {
  onRename: () => void;
  onDelete: () => void;
}

export function TaskMenu({ onRename, onDelete }: TaskMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="task-menu" ref={ref}>
      <button
        className="task-menu__trigger"
        onClick={() => setOpen((v) => !v)}
        aria-label="Acciones de tarea"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="task-menu__dropdown" role="menu" onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}>
          <button className="task-menu__item" role="menuitem" onClick={() => { onRename(); setOpen(false); }}>
            <Pencil size={14} aria-hidden="true" />
            Renombrar
          </button>
          <button
            className="task-menu__item task-menu__item--danger"
            role="menuitem"
            onClick={() => { onDelete(); setOpen(false); }}
          >
            <Trash2 size={14} aria-hidden="true" />
            Eliminar
          </button>
        </div>
      )}
    </div>
  );
}

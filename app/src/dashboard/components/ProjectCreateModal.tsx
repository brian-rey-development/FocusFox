import { useState, useRef, useEffect } from 'react';
import { PROJECT_COLORS, PROJECT_COLOR_HEX } from '@/modules/project/domain/types';
import type { ProjectColor } from '@/modules/project/domain/types';
import type { Project } from '@/modules/project/domain/types';
import { sendMessage } from '@/shared/messages';

interface ProjectCreateModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

export function ProjectCreateModal({ open, onClose, onCreated }: ProjectCreateModalProps) {
  const [name, setName] = useState('');
  const [color, setColor] = useState<ProjectColor>('blue');
  const [error, setError] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) nameRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) { setName(''); setColor('blue'); setError(''); }
  }, [open]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  async function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) { setError('El nombre es obligatorio.'); return; }
    if (trimmed.length > 80) { setError('Máximo 80 caracteres.'); return; }

    try {
      const project = await sendMessage<Project>('project:create', { name: trimmed, color });
      onCreated(project);
      onClose();
    } catch {
      setError('Error al crear el proyecto.');
    }
  }

  if (!open) return null;

  return (
    <div className="confirm-modal-overlay" onClick={onClose}>
      <div className="confirm-modal project-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="project-modal-title">
        <h3 id="project-modal-title">Nuevo proyecto</h3>
        <label className="project-modal__field">
          Nombre
          <input
            ref={nameRef}
            className="confirm-modal__type-input"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
            maxLength={80}
          />
        </label>
        {error && <p className="project-modal__error">{error}</p>}
        <div className="project-modal__colors" role="radiogroup" aria-label="Color">
          {PROJECT_COLORS.map((c) => (
            <button
              key={c}
              className={`project-modal__swatch${color === c ? ' project-modal__swatch--selected' : ''}`}
              style={{ backgroundColor: PROJECT_COLOR_HEX[c] }}
              onClick={() => setColor(c)}
              role="radio"
              aria-checked={color === c}
              aria-label={c}
            />
          ))}
        </div>
        <div className="confirm-modal__actions">
          <button className="confirm-modal__cancel" onClick={onClose}>
            Cancelar
          </button>
          <button className="confirm-modal__confirm" onClick={handleSubmit}>
            Crear
          </button>
        </div>
      </div>
    </div>
  );
}

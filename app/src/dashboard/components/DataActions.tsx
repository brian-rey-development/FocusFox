import { sendMessage } from '@/shared/messages';
import { useRef, useState, useEffect } from 'react';
import type { ExportPayload } from '@/modules/data/domain/types';

interface DataActionsProps {
  onSaved: () => void;
}

export function DataActions({ onSaved }: DataActionsProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<ExportPayload | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetTyped, setResetTyped] = useState('');
  const [importError, setImportError] = useState('');

  async function handleExport() {
    try {
      const payload = await sendMessage<ExportPayload>('data:export');
      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, '0');
      const d = String(now.getDate()).padStart(2, '0');

      const a = document.createElement('a');
      a.href = url;
      a.download = `focusfox-export-${y}${m}${d}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }

  function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        setImportError('Error al leer el archivo.');
        return;
      }
      try {
        const payload = JSON.parse(result);
        if (payload.formatVersion !== 1) {
          setImportError('Versión de formato no compatible.');
          return;
        }
        setImportPreview(payload);
      } catch {
        setImportError('El archivo no es válido.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  async function handleImportConfirm() {
    if (!importPreview) return;
    try {
      await sendMessage('data:import', importPreview);
      setImportPreview(null);
      onSaved();
    } catch {}
  }

  async function handleReset() {
    try {
      await sendMessage('data:reset');
      setResetConfirm(false);
      setResetTyped('');
      onSaved();
    } catch {}
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (importPreview) setImportPreview(null);
        if (resetConfirm) { setResetConfirm(false); setResetTyped(''); }
      }
    }
    if (importPreview || resetConfirm) {
      window.addEventListener('keydown', onKeyDown);
      return () => window.removeEventListener('keydown', onKeyDown);
    }
  }, [importPreview, resetConfirm]);

  return (
    <div className="data-actions">
      <input
        ref={fileRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleFileSelected}
      />
      {importError && <p className="data-actions__error">{importError}</p>}

      <div className="data-actions__group">
        <button className="data-actions__btn" onClick={handleExport}>
          Exportar datos
        </button>
        <p className="data-actions__desc">Descargá tus datos como archivo JSON.</p>
      </div>

      <div className="data-actions__group">
        <button className="data-actions__btn" onClick={() => fileRef.current?.click()}>
          Importar datos
        </button>
        <p className="data-actions__desc">Restaurá datos desde un archivo JSON.</p>
      </div>

      <div className="data-actions__group">
        <button className="data-actions__btn data-actions__btn--danger" onClick={() => setResetConfirm(true)}>
          Borrar todos los datos
        </button>
        <p className="data-actions__desc">Eliminá todo el contenido de FocusFox.</p>
      </div>

      {importPreview && (
        <div className="confirm-modal-overlay" onClick={() => setImportPreview(null)}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Importar datos</h3>
            <p>
              Vas a reemplazar todos tus datos con:
            </p>
            <ul>
              <li>{importPreview.data.projects.length} proyectos</li>
              <li>{importPreview.data.tasks.length} tareas</li>
              <li>{importPreview.data.pomodoros.length} pomodoros</li>
            </ul>
            <div className="confirm-modal__actions">
              <button className="confirm-modal__cancel" onClick={() => setImportPreview(null)}>
                Cancelar
              </button>
              <button className="confirm-modal__confirm" onClick={handleImportConfirm}>
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {resetConfirm && (
        <div className="confirm-modal-overlay" onClick={() => { setResetConfirm(false); setResetTyped(''); }}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Borrar todos los datos</h3>
            <p>Vas a borrar todo. Esta acción es irreversible.</p>
            <p className="confirm-modal__type-label">Escribí BORRAR para confirmar:</p>
            <input
              className="confirm-modal__type-input"
              value={resetTyped}
              onChange={(e) => setResetTyped(e.target.value)}
              placeholder="BORRAR"
            />
            <div className="confirm-modal__actions">
              <button className="confirm-modal__cancel" onClick={() => { setResetConfirm(false); setResetTyped(''); }}>
                Cancelar
              </button>
              <button
                className="confirm-modal__confirm confirm-modal__confirm--danger"
                onClick={handleReset}
                disabled={resetTyped !== 'BORRAR'}
              >
                Borrar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

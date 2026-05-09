import { useEffect, useState, useCallback } from 'react';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastData {
  id: string;
  message: string;
  variant: ToastVariant;
  durationMs?: number;
}

interface ToastItemProps {
  toast: ToastData;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const [exiting, setExiting] = useState(false);

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 200);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    const timer = setTimeout(dismiss, toast.durationMs ?? 3000);
    return () => clearTimeout(timer);
  }, [dismiss, toast.durationMs]);

  return (
    <div className={`ToastItem ToastItem--${toast.variant}${exiting ? ' ToastItem--exit' : ''}`}>
      <span className="ToastItem__message">{toast.message}</span>
      <button className="ToastItem__close" onClick={dismiss} aria-label="Cerrar">
        <X size={14} />
      </button>
    </div>
  );
}

interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  children?: ReactNode;
}

export function ToastContainer({ toasts, onDismiss, children }: ToastContainerProps) {
  return (
    <div className="ToastContainer">
      {children}
      <div className="ToastContainer__list" aria-live="polite">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

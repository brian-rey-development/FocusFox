import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { connectPort } from '@/shared/messages';
import { usePopupStore } from './PopupStore';
import type { TickPayload } from './PopupStore';
import { Header } from './components/Header';
import { LoadingView } from './views/LoadingView';
import { ErrorView } from './views/ErrorView';
import { IdleView } from './views/IdleView';
import { ActiveView } from './views/ActiveView';
import { BreakView } from './views/BreakView';
import './popup.css';

function App() {
  const phase = usePopupStore((s) => s.phase);
  const error = usePopupStore((s) => s.error);
  const init = usePopupStore((s) => s.init);
  const applyTick = usePopupStore((s) => s.applyTick);
  const applyEvent = usePopupStore((s) => s.applyEvent);
  const setError = usePopupStore((s) => s.setError);
  const retry = usePopupStore((s) => s.retry);
  const portRef = useRef<browser.runtime.Port | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const port = connectPort('popup');
      portRef.current = port;

      port.onMessage.addListener((raw: object) => {
        const msg = raw as { type: string; data: unknown };
        if (msg.type === 'tick' && msg.data) {
          applyTick(msg.data as TickPayload);
        } else if (msg.type === 'event' && msg.data) {
          applyEvent(msg.data as { type: string });
        }
      });

      port.onDisconnect.addListener(() => {
        if (!cancelled) {
          setError('Se perdió la conexión. Reabrí el popup.');
        }
      });

      await init();
    }

    mount();

    return () => {
      cancelled = true;
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [init, applyTick, applyEvent, setError]);

  return (
    <>
      <Header phase={phase} />
      <main className="popup-content">
        {phase === 'loading' && <LoadingView />}
        {phase === 'error' && (
          <ErrorView message={error ?? 'Error desconocido'} onRetry={retry} />
        )}
        {phase === 'idle' && <IdleView />}
        {phase === 'active' && <ActiveView />}
        {phase === 'break' && <BreakView />}
      </main>
    </>
  );
}

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(<ErrorBoundary><App /></ErrorBoundary>);
}

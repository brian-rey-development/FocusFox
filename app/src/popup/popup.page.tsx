import { useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
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
  const setError = usePopupStore((s) => s.setError);
  const retry = usePopupStore((s) => s.retry);
  const portRef = useRef<browser.runtime.Port | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function mount() {
      const port = connectPort('popup');
      portRef.current = port;

      port.onMessage.addListener((raw: object) => {
        const msg = raw as { type: string; data: TickPayload };
        if (msg.type === 'tick' && msg.data) {
          applyTick(msg.data);
        }
      });

      port.onDisconnect.addListener(() => {
        if (!cancelled) {
          setError('Connection lost. Please reopen the popup.');
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
  }, [init, applyTick, setError]);

  return (
    <>
      <Header phase={phase} />
      <main className="popup-content">
        {phase === 'loading' && <LoadingView />}
        {phase === 'error' && (
          <ErrorView message={error ?? 'Unknown error'} onRetry={retry} />
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
  createRoot(root).render(<App />);
}

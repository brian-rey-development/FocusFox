import { useEffect, useRef, useState, useCallback } from 'react';
import type { Tick } from '@/shared/engine-types';
import type { TodayStats } from '@/modules/stats/domain/types';
import type { StreakStats } from '@/modules/stats/domain/types';
import { useBlockedStore } from './store';
import { parseBlockedParams, safeRedirectUrl } from './utils';
import { Stage } from './components/Stage';
import { BlockedHeader } from './components/BlockedHeader';
import { TaskTimeCard } from './components/TaskTimeCard';
import { TodayMiniStats } from './components/TodayMiniStats';
import { CancelLink } from './components/CancelLink';
import { AttemptedUrl } from './components/AttemptedUrl';
import { ErrorToast } from './components/ErrorToast';

const SNAPSHOT_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Parse params synchronously at module evaluation time so the skeleton
// can show the domain before any async call completes.
const { originalUrl: INITIAL_URL, domain: INITIAL_DOMAIN } = parseBlockedParams(window.location.search);

export function App() {
  const [mounted, setMounted] = useState(false);
  const portRef = useRef<browser.runtime.Port | null>(null);
  const originalUrlRef = useRef(INITIAL_URL);

  const setSnapshot = useBlockedStore((s) => s.setSnapshot);
  const setRemainingMs = useBlockedStore((s) => s.setRemainingMs);
  const setToday = useBlockedStore((s) => s.setToday);
  const setStreakDays = useBlockedStore((s) => s.setStreakDays);
  const setError = useBlockedStore((s) => s.setError);
  const error = useBlockedStore((s) => s.error);

  const snapshot = useBlockedStore((s) => s.snapshot);
  const remainingMs = useBlockedStore((s) => s.remainingMs);
  const today = useBlockedStore((s) => s.today);
  const streakDays = useBlockedStore((s) => s.streakDays);

  const mount = useCallback(async () => {
    // originalUrlRef and domain are already seeded from the synchronous parse above;
    // read the current ref value so retry calls also work correctly.
    const originalUrl = originalUrlRef.current;

    async function requestSnapshot(): Promise<Tick | null> {
      try {
        return await withTimeout(
          browser.runtime.sendMessage({ type: 'pomodoro:snapshot' }) as Promise<Tick>,
          SNAPSHOT_TIMEOUT_MS,
        );
      } catch {
        setError('unreachable');
        return null;
      }
    }

    function requestStat(type: string, onOk: (data: unknown) => void): void {
      browser.runtime.sendMessage({ type }).then(onOk).catch(() => {});
    }

    function connectTickPort(url: string): browser.runtime.Port {
      const port = browser.runtime.connect({ name: 'tick' });

      port.onMessage.addListener((raw: object) => {
        const msg = raw as { type: string; data?: Tick };
        if (msg.type === 'tick' && msg.data) {
          setRemainingMs(msg.data.remainingMs);
          if (msg.data.phase !== 'work') {
            window.location.replace(safeRedirectUrl(url, 'about:blank'));
          }
        }
      });

      port.onDisconnect.addListener(() => {
        setError('unreachable');
      });

      return port;
    }

    const tick = await requestSnapshot();
    if (!tick) return;

    if (tick.phase !== 'work') {
      window.location.replace(safeRedirectUrl(originalUrl, 'about:blank'));
      return;
    }

    setSnapshot(tick);
    setRemainingMs(tick.remainingMs);

    requestStat('stats:today', (data) => setToday(data as TodayStats));
    requestStat('stats:streak', (data) => setStreakDays((data as StreakStats).currentDays));

    const port = connectTickPort(originalUrl);
    portRef.current = port;
    setMounted(true);
  }, [setSnapshot, setRemainingMs, setToday, setStreakDays, setError]);

  useEffect(() => {
    void mount();

    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [mount]);

  async function handleCancel(): Promise<void> {
    try {
      const response = await browser.runtime.sendMessage({ type: 'pomodoro:cancel' });
      if (
        response !== null &&
        typeof response === 'object' &&
        'ok' in response &&
        (response as { ok: boolean }).ok
      ) {
        window.location.replace(safeRedirectUrl(originalUrlRef.current, 'about:blank'));
      }
    } catch {
      // ignore cancel errors - the session may already be done
    }
  }

  if (error === 'unreachable') {
    return <ErrorToast onRetry={() => { setError(null); mount(); }} />;
  }

  if (!mounted || !snapshot) {
    return (
      <Stage>
        <BlockedHeader />
        <div className="task-time-card">
          <div className="task-time-card__left">
            <span className="task-time-card__label">Tarea actual</span>
            <span className="task-time-card__title blocked-skeleton">---</span>
            <span className="task-time-card__meta blocked-skeleton">{INITIAL_DOMAIN}</span>
          </div>
          <div className="task-time-card__right">
            <span className="task-time-card__time blocked-skeleton">--:--</span>
            <span className="task-time-card__time-label">restantes</span>
          </div>
        </div>
      </Stage>
    );
  }

  const todayValue = today ?? { workPomodoros: 0, distractions: 0, focusMinutes: 0, deltaVs30dAvg: 0 };

  return (
    <Stage>
      <BlockedHeader />
      <TaskTimeCard
        task={snapshot.task ?? { id: '', title: '' }}
        project={{
          name: snapshot.task?.projectName ?? '',
          color: snapshot.task?.projectColor ?? 'orange',
        }}
        remainingMs={remainingMs}
        cycleIndex={snapshot.cycleIndex}
        longBreakEvery={snapshot.longBreakEvery}
      />
      <TodayMiniStats today={todayValue} streakDays={streakDays} />
      <CancelLink onCancel={handleCancel} />
      <AttemptedUrl url={INITIAL_DOMAIN} />
    </Stage>
  );
}

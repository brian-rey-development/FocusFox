import { useEffect, useRef, useState, useCallback } from 'react';
import type { Tick } from '@/shared/engine-types';
import type { TodayStats } from '@/modules/stats/domain/types';
import type { StreakStats } from '@/modules/stats/domain/types';
import { useBlockedStore } from './store';
import { parseBlockedParams } from './utils';
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

export function App() {
  const [domain, setDomain] = useState('unknown');
  const [mounted, setMounted] = useState(false);
  const portRef = useRef<browser.runtime.Port | null>(null);
  const originalUrlRef = useRef('');

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
    const { originalUrl, domain: parsedDomain } = parseBlockedParams(window.location.search);
    originalUrlRef.current = originalUrl;
    setDomain(parsedDomain);

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
            window.location.replace(url || 'about:home');
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
      window.location.replace(originalUrl || 'about:home');
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
    mount();

    return () => {
      if (portRef.current) {
        portRef.current.disconnect();
        portRef.current = null;
      }
    };
  }, [mount]);

  async function handleCancel(): Promise<void> {
    const response = (await browser.runtime.sendMessage({ type: 'pomodoro:cancel' })) as { ok?: boolean };
    if (response?.ok) {
      window.location.replace(originalUrlRef.current || 'about:home');
    }
  }

  if (error === 'unreachable') {
    return <ErrorToast onRetry={() => { setError(null); mount(); }} />;
  }

  if (!mounted || !snapshot) {
    return null;
  }

  const todayValue = today ?? { workPomodoros: 0, distractions: 0 };

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
      <AttemptedUrl url={domain} />
    </Stage>
  );
}

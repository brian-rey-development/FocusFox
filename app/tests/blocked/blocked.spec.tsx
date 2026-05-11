import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { parseBlockedParams, formatRemaining } from '../../src/blocked/utils';
import { useBlockedStore } from '../../src/blocked/store';
import { App } from '../../src/blocked/App';
import type { Tick } from '../../src/shared/engine-types';
import type { TodayStats, StreakStats } from '../../src/modules/stats/domain/types';

// --- Helpers ---

function makeTick(overrides: Partial<Tick> = {}): Tick {
  return {
    phase: 'work',
    remainingMs: 25 * 60 * 1000,
    pomodoroId: 'pomo-1',
    plannedDurationMs: 25 * 60 * 1000,
    task: {
      id: 'task-1',
      title: 'Build FocusFox',
      projectId: 'proj-1',
      projectName: 'Producto',
      projectColor: 'orange',
    },
    cycleIndex: 2,
    longBreakEvery: 4,
    distractionCountSession: 0,
    ...overrides,
  };
}

function makeTodayStats(overrides: Partial<TodayStats> = {}): TodayStats {
  return {
    workPomodoros: 3,
    distractions: 1,
    focusMinutes: 75,
    deltaVs30dAvg: 1,
    ...overrides,
  };
}

function makeStreakStats(overrides: Partial<StreakStats> = {}): StreakStats {
  return {
    currentDays: 5,
    longestDays: 12,
    active: true,
    ...overrides,
  };
}

function makePort() {
  const listeners: Array<(msg: unknown) => void> = [];
  return {
    name: 'tick',
    onMessage: {
      addListener: vi.fn((fn: (msg: unknown) => void) => listeners.push(fn)),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    onDisconnect: {
      addListener: vi.fn(),
      removeListener: vi.fn(),
      hasListener: vi.fn(),
    },
    disconnect: vi.fn(),
    postMessage: vi.fn(),
    _tick: (tick: Tick) => listeners.forEach((fn) => fn({ type: 'tick', data: tick })),
  } as unknown as browser.runtime.Port & { _tick: (tick: Tick) => void };
}

type MockRuntime = {
  sendMessage: ReturnType<typeof vi.fn>;
  connect: ReturnType<typeof vi.fn<[], browser.runtime.Port>>;
};

function setupMockRuntime(): MockRuntime {
  const sendMessage = vi.fn();
  const connect = vi.fn((() => makePort()) as () => browser.runtime.Port);

  globalThis.browser = {
    runtime: {
      sendMessage,
      connect,
      onMessage: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
      onConnect: { addListener: vi.fn(), removeListener: vi.fn(), hasListener: vi.fn() },
    },
  } as unknown as typeof browser;

  return { sendMessage, connect };
}

function resetStore() {
  useBlockedStore.setState({
    snapshot: null,
    remainingMs: 0,
    today: null,
    streakDays: 0,
    error: null,
    confirmCancel: false,
  });
}

// --- Pure function tests ---

describe('parseBlockedParams', () => {
  it('extracts url and domain from query string', () => {
    const result = parseBlockedParams('?url=https%3A%2F%2Fexample.com&domain=example.com');
    expect(result.originalUrl).toBe('https://example.com');
    expect(result.domain).toBe('example.com');
  });

  it('defaults missing url to empty string', () => {
    const result = parseBlockedParams('?domain=example.com');
    expect(result.originalUrl).toBe('');
    expect(result.domain).toBe('example.com');
  });

  it('defaults missing domain to unknown', () => {
    const result = parseBlockedParams('?url=https%3A%2F%2Fexample.com');
    expect(result.originalUrl).toBe('https://example.com');
    expect(result.domain).toBe('unknown');
  });

  it('handles empty query string', () => {
    const result = parseBlockedParams('');
    expect(result.originalUrl).toBe('');
    expect(result.domain).toBe('unknown');
  });

  it('handles malformed URL encoding', () => {
    const result = parseBlockedParams('?url=%ZZ');
    expect(result.originalUrl).toBe('');
    expect(result.domain).toBe('unknown');
  });

  it('handles empty url param', () => {
    const result = parseBlockedParams('?url=&domain=test.com');
    expect(result.originalUrl).toBe('');
    expect(result.domain).toBe('test.com');
  });
});

describe('formatRemaining', () => {
  it('formats 25 minutes', () => {
    expect(formatRemaining(25 * 60 * 1000)).toBe('25:00');
  });

  it('formats 0 ms', () => {
    expect(formatRemaining(0)).toBe('00:00');
  });

  it('formats 59_999 ms as 01:00 (ceil)', () => {
    expect(formatRemaining(59_999)).toBe('01:00');
  });

  it('formats 60_000 ms', () => {
    expect(formatRemaining(60_000)).toBe('01:00');
  });

  it('handles negative values by treating as 0', () => {
    expect(formatRemaining(-1000)).toBe('00:00');
  });

  it('formats 23:45', () => {
    expect(formatRemaining(23 * 60 * 1000 + 45 * 1000)).toBe('23:45');
  });
});

// --- Store tests ---

describe('useBlockedStore', () => {
  beforeEach(resetStore);

  it('has default values', () => {
    const state = useBlockedStore.getState();
    expect(state.snapshot).toBeNull();
    expect(state.remainingMs).toBe(0);
    expect(state.today).toBeNull();
    expect(state.streakDays).toBe(0);
    expect(state.error).toBeNull();
    expect(state.confirmCancel).toBe(false);
  });

  it('setSnapshot updates snapshot and clears error', () => {
    useBlockedStore.getState().setError('unreachable');
    const tick = makeTick();
    useBlockedStore.getState().setSnapshot(tick);
    const state = useBlockedStore.getState();
    expect(state.snapshot).toEqual(tick);
    expect(state.error).toBeNull();
  });

  it('setRemainingMs updates remainingMs', () => {
    useBlockedStore.getState().setRemainingMs(5000);
    expect(useBlockedStore.getState().remainingMs).toBe(5000);
  });

  it('setToday updates today stats', () => {
    const stats = makeTodayStats();
    useBlockedStore.getState().setToday(stats);
    expect(useBlockedStore.getState().today).toEqual(stats);
  });

  it('setStreakDays updates streak days', () => {
    useBlockedStore.getState().setStreakDays(7);
    expect(useBlockedStore.getState().streakDays).toBe(7);
  });

  it('setError sets error state', () => {
    useBlockedStore.getState().setError('unreachable');
    expect(useBlockedStore.getState().error).toBe('unreachable');
  });

  it('setConfirmCancel toggles confirmation', () => {
    useBlockedStore.getState().setConfirmCancel(true);
    expect(useBlockedStore.getState().confirmCancel).toBe(true);
    useBlockedStore.getState().setConfirmCancel(false);
    expect(useBlockedStore.getState().confirmCancel).toBe(false);
  });
});

// --- App mount logic tests ---

describe('App', () => {
  let mockRuntime: MockRuntime;

  beforeEach(() => {
    resetStore();
    mockRuntime = setupMockRuntime();
    delete (window as any).location;
    (window as any).location = {
      search: '?url=https%3A%2F%2Fexample.com&domain=example.com',
      replace: vi.fn(),
    } as unknown as Location;
  });

  it('redirects immediately if snapshot phase is not work', async () => {
    const tick = makeTick({ phase: 'idle' });
    mockRuntime.sendMessage.mockResolvedValue(tick);

    render(<App />);

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });
  });

  it('redirects to about:home when url param is missing and phase is not work', async () => {
    (window as any).location.search = '?domain=example.com';
    const tick = makeTick({ phase: 'idle' });
    mockRuntime.sendMessage.mockResolvedValue(tick);

    render(<App />);

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('about:home');
    });
  });

  it('shows error toast when snapshot times out', async () => {
    mockRuntime.sendMessage.mockImplementation(() => new Promise(() => {}));

    render(<App />);

    await waitFor(
      () => {
        expect(screen.getByText(/No se pudo contactar al motor/)).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
  });

  it('renders blocked UI when snapshot is work phase', async () => {
    const tick = makeTick();
    const stats = makeTodayStats();
    const streak = makeStreakStats();

    mockRuntime.sendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'pomodoro:snapshot') return Promise.resolve(tick);
      if (msg.type === 'stats:today') return Promise.resolve(stats);
      if (msg.type === 'stats:streak') return Promise.resolve(streak);
      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Estás en foco.')).toBeInTheDocument();
    });

    expect(screen.getByText('Build FocusFox')).toBeInTheDocument();
    expect(screen.getByText(/cancelar pomodoro/)).toBeInTheDocument();
  });

  it('shows confirm cancel UI when cancel is clicked', async () => {
    const tick = makeTick();
    const stats = makeTodayStats();
    const streak = makeStreakStats();

    mockRuntime.sendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'pomodoro:snapshot') return Promise.resolve(tick);
      if (msg.type === 'stats:today') return Promise.resolve(stats);
      if (msg.type === 'stats:streak') return Promise.resolve(streak);
      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Estás en foco.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/cancelar pomodoro/));

    await waitFor(() => {
      expect(screen.getByText('¿Seguro? Vas a perder este pomodoro.')).toBeInTheDocument();
      expect(screen.getByText('Sí, cancelar pomodoro y desbloquear')).toBeInTheDocument();
      expect(screen.getByText('Volver')).toBeInTheDocument();
    });
  });

  it('sends cancel message and redirects on confirm', async () => {
    const tick = makeTick();
    const stats = makeTodayStats();
    const streak = makeStreakStats();

    mockRuntime.sendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'pomodoro:snapshot') return Promise.resolve(tick);
      if (msg.type === 'stats:today') return Promise.resolve(stats);
      if (msg.type === 'stats:streak') return Promise.resolve(streak);
      if (msg.type === 'pomodoro:cancel') return Promise.resolve({ ok: true });
      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Estás en foco.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/cancelar pomodoro/));

    await waitFor(() => {
      expect(screen.getByText('Sí, cancelar pomodoro y desbloquear')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Sí, cancelar pomodoro y desbloquear'));

    await waitFor(() => {
      expect(mockRuntime.sendMessage).toHaveBeenCalledWith({ type: 'pomodoro:cancel' });
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });
  });

  it('redirects on tick when phase changes from work', async () => {
    const tick = makeTick();
    mockRuntime.sendMessage.mockResolvedValue(tick);

    const port = makePort();
    mockRuntime.connect.mockReturnValue(port);

    render(<App />);

    await waitFor(() => {
      expect(mockRuntime.connect).toHaveBeenCalledWith({ name: 'tick' });
    });

    const breakTick = makeTick({ phase: 'short_break' });
    port._tick(breakTick);

    await waitFor(() => {
      expect(window.location.replace).toHaveBeenCalledWith('https://example.com');
    });
  });

  it('disconnects port on unmount', async () => {
    const tick = makeTick();
    mockRuntime.sendMessage.mockResolvedValue(tick);
    const port = makePort();
    mockRuntime.connect.mockReturnValue(port);

    const { unmount } = render(<App />);

    await waitFor(() => {
      expect(mockRuntime.connect).toHaveBeenCalled();
    });

    unmount();

    expect(port.disconnect).toHaveBeenCalled();
  });

  it('displays today stats chips when loaded', async () => {
    const tick = makeTick();
    const stats = makeTodayStats({ workPomodoros: 4, distractions: 2 });
    const streak = makeStreakStats({ currentDays: 7 });

    mockRuntime.sendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'pomodoro:snapshot') return Promise.resolve(tick);
      if (msg.type === 'stats:today') return Promise.resolve(stats);
      if (msg.type === 'stats:streak') return Promise.resolve(streak);
      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('4 pomodoros hoy')).toBeInTheDocument();
      expect(screen.getByText('2 distracciones')).toBeInTheDocument();
      expect(screen.getByText('7d racha')).toBeInTheDocument();
    });
  });

  it('shows zeroed stats when stats request fails', async () => {
    const tick = makeTick();

    mockRuntime.sendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'pomodoro:snapshot') return Promise.resolve(tick);
      return Promise.reject(new Error('fail'));
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Estás en foco.')).toBeInTheDocument();
    });

    expect(screen.getByText('0 pomodoros hoy')).toBeInTheDocument();
    expect(screen.getByText('0 distracciones')).toBeInTheDocument();
    expect(screen.getByText('0d racha')).toBeInTheDocument();
  });

  it('dismisses cancel confirmation on Volver', async () => {
    const tick = makeTick();
    const stats = makeTodayStats();

    mockRuntime.sendMessage.mockImplementation((msg: { type: string }) => {
      if (msg.type === 'pomodoro:snapshot') return Promise.resolve(tick);
      if (msg.type === 'stats:today') return Promise.resolve(stats);
      if (msg.type === 'stats:streak') return Promise.resolve(makeStreakStats());
      return Promise.resolve(undefined);
    });

    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Estás en foco.')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText(/cancelar pomodoro/));

    await waitFor(() => {
      expect(screen.getByText('Volver')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Volver'));

    await waitFor(() => {
      expect(screen.queryByText('¿Seguro? Vas a perder este pomodoro.')).not.toBeInTheDocument();
    });
  });
});

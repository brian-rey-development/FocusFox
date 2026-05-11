import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { MiniTimer } from '../../../src/dashboard/components/MiniTimer';
import type { Tick } from '../../../src/shared/engine-types';

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

describe('MiniTimer', () => {
  it('renders remaining time formatted as mm:ss', () => {
    const tick = makeTick({ remainingMs: 25 * 60 * 1000 });
    render(<MiniTimer tick={tick} onClick={() => {}} />);
    expect(screen.getByText('25:00')).toBeInTheDocument();
  });

  it('renders task title when available', () => {
    const tick = makeTick();
    render(<MiniTimer tick={tick} onClick={() => {}} />);
    expect(screen.getByText('Build FocusFox')).toBeInTheDocument();
  });

  it('renders fallback label when no task', () => {
    const tick = makeTick({ task: null });
    render(<MiniTimer tick={tick} onClick={() => {}} />);
    expect(screen.getByText('Pomodoro activo')).toBeInTheDocument();
  });

  it('renders during break phase', () => {
    const tick = makeTick({ phase: 'short_break', remainingMs: 4 * 60 * 1000 });
    render(<MiniTimer tick={tick} onClick={() => {}} />);
    expect(screen.getByText('04:00')).toBeInTheDocument();
  });

  it('renders during long break phase', () => {
    const tick = makeTick({ phase: 'long_break', remainingMs: 15 * 60 * 1000 });
    render(<MiniTimer tick={tick} onClick={() => {}} />);
    expect(screen.getByText('15:00')).toBeInTheDocument();
  });

  it('has aria-label for accessibility', () => {
    const tick = makeTick();
    render(<MiniTimer tick={tick} onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Ver pomodoro activo' })).toBeInTheDocument();
  });
});

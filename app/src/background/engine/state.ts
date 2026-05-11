import type { EnginePhase, EngineState } from './types';

export function defaultState(): EngineState {
  return {
    phase: 'idle',
    pomodoroId: null,
    taskId: null,
    startedAt: null,
    plannedDurationMs: 0,
    cycleIndex: 1,
    distractionCountSession: 0,
  };
}

export function cloneState(s: EngineState): EngineState {
  return { ...s };
}

export function remainingMs(state: EngineState): number {
  if (state.phase === 'idle' || state.startedAt === null) return 0;
  return Math.max(0, state.plannedDurationMs - (Date.now() - state.startedAt));
}

export function currentPomodoroId(state: EngineState): string | null {
  return state.pomodoroId;
}

export function currentPhase(state: EngineState): EnginePhase {
  return state.phase;
}

export function nextBreakKind(cycleIndex: number, longBreakEvery: number): 'short_break' | 'long_break' {
  return cycleIndex === longBreakEvery ? 'long_break' : 'short_break';
}

const VALID_PHASES = new Set<EnginePhase>(['idle', 'work', 'short_break', 'long_break']);

export function isEngineState(value: unknown): value is EngineState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  const phase = typeof s.phase === 'string' && VALID_PHASES.has(s.phase as EnginePhase) ? s.phase as EnginePhase : null;
  if (!phase) return false;
  return (
    (s.pomodoroId === null || typeof s.pomodoroId === 'string') &&
    (s.taskId === null || typeof s.taskId === 'string') &&
    (s.startedAt === null || (typeof s.startedAt === 'number' && Number.isFinite(s.startedAt) && s.startedAt > 0)) &&
    typeof s.plannedDurationMs === 'number' &&
    Number.isFinite(s.plannedDurationMs) &&
    (phase === 'idle' || s.plannedDurationMs > 0) &&
    typeof s.cycleIndex === 'number' &&
    Number.isInteger(s.cycleIndex) &&
    s.cycleIndex >= 1 &&
    typeof s.distractionCountSession === 'number' &&
    Number.isInteger(s.distractionCountSession) &&
    s.distractionCountSession >= 0
  );
}

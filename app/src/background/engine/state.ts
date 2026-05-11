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

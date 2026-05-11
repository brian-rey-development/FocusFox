import type { DB } from '@/shared/database/types';
import type { EnginePhase, EngineState, FastStorage } from './types';

const KEY = 'engineState';

const VALID_PHASES = new Set<EnginePhase>(['idle', 'work', 'short_break', 'long_break']);

export async function saveEngineState(
  fast: FastStorage,
  db: DB,
  state: EngineState,
): Promise<void> {
  await Promise.all([
    fast.set(KEY, state),
    db.meta.set(KEY, state),
  ]);
}

export async function loadEngineState(
  fast: FastStorage,
  db: DB,
): Promise<EngineState | null> {
  const fastValue = await fast.get(KEY);
  if (fastValue && isEngineState(fastValue)) {
    return fastValue;
  }
  const durable = await db.meta.get(KEY);
  if (durable && isEngineState(durable)) {
    return durable;
  }
  return null;
}

function isEngineState(value: unknown): value is EngineState {
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

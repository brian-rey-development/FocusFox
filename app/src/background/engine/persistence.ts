import type { DB } from '@/shared/database/types';
import type { EngineState, FastStorage } from './types';

const KEY = 'engineState';

export async function saveEngineState(
  fast: FastStorage,
  db: DB,
  state: EngineState,
): Promise<void> {
  await fast.set(KEY, state);
  await db.meta.set(KEY, state);
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
    return durable as EngineState;
  }
  return null;
}

function isEngineState(value: unknown): value is EngineState {
  if (typeof value !== 'object' || value === null) return false;
  const s = value as Record<string, unknown>;
  return (
    typeof s.phase === 'string' &&
    (s.pomodoroId === null || typeof s.pomodoroId === 'string') &&
    (s.taskId === null || typeof s.taskId === 'string') &&
    (s.startedAt === null || typeof s.startedAt === 'number') &&
    typeof s.plannedDurationMs === 'number' &&
    typeof s.cycleIndex === 'number' &&
    typeof s.distractionCountSession === 'number'
  );
}

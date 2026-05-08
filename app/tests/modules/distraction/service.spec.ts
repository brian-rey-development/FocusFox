import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createDistractionService } from '@/modules/distraction/application/service';
import { DistractionSchema } from '@/modules/distraction/domain/types';

describe('DistractionService', () => {
  it('records a distraction', async () => {
    const db = await createFreshDB();
    const svc = createDistractionService(db);

    const result = await svc.record({ pomodoroId: 'pomo-1', type: 'manual', reason: 'Looked at phone' });

    expect(DistractionSchema.parse(result)).toBeTruthy();
    expect(result.type).toBe('manual');
  });

  it('dedupes auto_blocked_attempt by domain', async () => {
    const db = await createFreshDB();
    const svc = createDistractionService(db);

    const first = await svc.record({ pomodoroId: 'pomo-1', type: 'auto_blocked_attempt', domain: 'reddit.com', url: 'https://reddit.com' });
    const second = await svc.record({ pomodoroId: 'pomo-1', type: 'auto_blocked_attempt', domain: 'reddit.com', url: 'https://reddit.com' });

    expect(second.id).toBe(first.id);
  });

  it('does not dedupe different domains', async () => {
    const db = await createFreshDB();
    const svc = createDistractionService(db);

    const first = await svc.record({ pomodoroId: 'pomo-1', type: 'auto_blocked_attempt', domain: 'reddit.com' });
    const second = await svc.record({ pomodoroId: 'pomo-1', type: 'auto_blocked_attempt', domain: 'twitter.com' });

    expect(second.id).not.toBe(first.id);
  });

  it('listForPomodoro returns distractions', async () => {
    const db = await createFreshDB();
    const svc = createDistractionService(db);

    await svc.record({ pomodoroId: 'pomo-1', type: 'manual', reason: 'First' });
    await svc.record({ pomodoroId: 'pomo-1', type: 'manual', reason: 'Second' });

    const list = await svc.listForPomodoro('pomo-1');
    expect(list).toHaveLength(2);
  });

  it('rejects invalid input', async () => {
    const db = await createFreshDB();
    const svc = createDistractionService(db);

    await expect(svc.record({ pomodoroId: 'pomo-1', type: 'invalid' })).rejects.toThrow();
  });
});

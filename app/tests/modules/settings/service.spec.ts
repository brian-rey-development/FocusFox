import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createSettingsService } from '@/modules/settings/application/service';
import { SettingsSchema } from '@/modules/settings/domain/types';

describe('SettingsService', () => {
  it('gets default settings', async () => {
    const db = await createFreshDB();
    const svc = createSettingsService(db);

    const settings = await svc.get();

    expect(settings.workMs).toBe(25 * 60_000);
  });

  it('returns valid Settings shape', async () => {
    const db = await createFreshDB();
    const svc = createSettingsService(db);

    const settings = await svc.get();

    expect(() => SettingsSchema.parse(settings)).not.toThrow();
  });

  it('updates settings', async () => {
    const db = await createFreshDB();
    const svc = createSettingsService(db);

    const updated = await svc.update({ workMs: 30 * 60_000 });

    expect(updated.workMs).toBe(30 * 60_000);
    expect(() => SettingsSchema.parse(updated)).not.toThrow();
  });

  it('rejects invalid update input', async () => {
    const db = await createFreshDB();
    const svc = createSettingsService(db);

    await expect(svc.update({ workMs: -1 })).rejects.toThrow();
  });
});

import { describe, it, expect } from 'vitest';
import { createFreshDB } from '../../helpers';
import { createMetaService } from '@/modules/meta/application/service';

describe('MetaService', () => {
  it('returns null for missing key', async () => {
    const db = await createFreshDB();
    const svc = createMetaService(db);

    const result = await svc.get('nonexistent');

    expect(result).toBeNull();
  });

  it('returns value after set', async () => {
    const db = await createFreshDB();
    const svc = createMetaService(db);

    await svc.set('theme', 'dark');
    const result = await svc.get('theme');

    expect(result).toBe('dark');
  });

  it('sets complex objects', async () => {
    const db = await createFreshDB();
    const svc = createMetaService(db);

    const obj = { a: 1, b: [2, 3] };
    await svc.set('config', obj);
    const result = await svc.get('config');

    expect(result).toEqual(obj);
  });
});

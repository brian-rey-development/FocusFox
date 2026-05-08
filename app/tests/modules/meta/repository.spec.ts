import { describe, it, expect, beforeEach } from 'vitest';
import { createFreshDB } from '../../helpers';
import type { DB } from '@/shared/database';

describe('MetaRepo', () => {
  let db: DB;

  beforeEach(async () => {
    db = await createFreshDB();
  });

  it('returns null for non-existent key', async () => {
    const val = await db.meta.get('no-such-key');
    expect(val).toBeNull();
  });

  it('stores and retrieves a string', async () => {
    await db.meta.set('greeting', 'hello');
    const val = await db.meta.get<string>('greeting');
    expect(val).toBe('hello');
  });

  it('stores and retrieves a complex object', async () => {
    const obj = { foo: [1, 2, 3], bar: true };
    await db.meta.set('my-obj', obj);
    const val = await db.meta.get<typeof obj>('my-obj');
    expect(val).toEqual(obj);
  });

  it('overwrites an existing key', async () => {
    await db.meta.set('key', 'first');
    await db.meta.set('key', 'second');
    const val = await db.meta.get<string>('key');
    expect(val).toBe('second');
  });

  it('stores a null value', async () => {
    await db.meta.set('nullable', null);
    const val = await db.meta.get('nullable');
    expect(val).toBeNull();
  });
});

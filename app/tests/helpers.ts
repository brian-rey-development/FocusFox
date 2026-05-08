import { openDB } from '@/shared/database';
import type { DB } from '@/shared/database';

export async function createFreshDB(): Promise<DB> {
  const db = await openDB();
  await db.resetAllData();
  return db;
}

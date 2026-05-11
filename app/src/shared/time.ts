export function dayKey(at: number): string {
  if (!Number.isFinite(at)) throw new Error('Invalid timestamp');
  const d = new Date(at);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function rangeKeys(days: number): string[] {
  const count = Math.max(1, days);
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    keys.push(dayKey(d.getTime()));
  }
  return keys;
}

export function offsetDayKey(key: string, offset: number): string {
  const parts = key.split('-').map(Number);
  if (parts.length !== 3 || parts.some((p) => !Number.isFinite(p))) {
    throw new Error(`Invalid day key: ${key}`);
  }
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  if (isNaN(d.getTime())) throw new Error(`Invalid day key: ${key}`);
  d.setDate(d.getDate() + offset);
  return dayKey(d.getTime());
}

const DOMAIN_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export function normalizeDomain(input: string): string {
  return input
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .replace(/\/.*$/, '')
    .toLowerCase();
}

export function isValidDomain(d: string): boolean {
  if (!DOMAIN_RE.test(d)) return false;
  const parts = d.split('.');
  return parts.some((p) => /[a-z]/i.test(p));
}

export function clampMinutes(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function msToMinutes(ms: number): number {
  return Math.floor(ms / 60_000);
}

export function minutesToMs(minutes: number): number {
  return minutes * 60_000;
}

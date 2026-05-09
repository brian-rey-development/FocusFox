let cached: string[] = [];

export function getAllowlist(): string[] {
  return [...cached];
}

export function setAllowlist(domains: string[]): void {
  cached = domains.map(d => d.toLowerCase().trim()).filter(Boolean);
}

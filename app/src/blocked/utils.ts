export function parseBlockedParams(search: string): { originalUrl: string; domain: string } {
  const params = new URLSearchParams(search);
  const raw = params.get('url') ?? '';
  const domain = params.get('domain') ?? 'unknown';
  let originalUrl = '';

  try {
    originalUrl = raw ? decodeURIComponent(raw) : '';
  } catch {
    originalUrl = '';
  }

  return { originalUrl, domain };
}

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * Validates that a URL uses an allowed protocol before navigating.
 * Returns the URL if safe, or a fallback destination if not.
 */
export function safeRedirectUrl(url: string, fallback = 'about:blank'): string {
  if (!url) return fallback;
  try {
    const { protocol } = new URL(url);
    return ALLOWED_PROTOCOLS.has(protocol) ? url : fallback;
  } catch {
    return fallback;
  }
}

export function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

import type { EnginePhase } from '@/shared/engine-types';
import type { BlockDecision } from '@/shared/blocker-types';
import type { DistractionService } from '@/modules/distraction/application/service';
import { getAllowlist } from './allowlist-cache';

const ALWAYS_ALLOW_PROTOCOLS = new Set([
  'moz-extension:',
  'about:',
  'file:',
  'chrome:',
  'data:',
  'view-source:',
]);

export function isAllowedDomain(hostname: string, allowlist: string[]): boolean {
  return allowlist.some(d => hostname === d || hostname.endsWith('.' + d));
}

export function buildBlockedUrl(originalUrl: string, domain: string, blockedPageBase: string): string {
  return `${blockedPageBase}?url=${encodeURIComponent(originalUrl)}&domain=${encodeURIComponent(domain)}`;
}

export function shouldBlock(
  url: string,
  allowlist: string[],
  _extId: string,
  state: EnginePhase,
): BlockDecision {
  if (state !== 'work') return { block: false, domain: null };

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { block: false, domain: null };
  }

  if (ALWAYS_ALLOW_PROTOCOLS.has(parsed.protocol)) return { block: false, domain: null };

  const hostname = parsed.hostname.toLowerCase();

  if (isAllowedDomain(hostname, allowlist.map(d => d.toLowerCase()))) return { block: false, domain: hostname };

  return { block: true, domain: hostname };
}

export function registerBlocker(
  engine: { currentPhase(): EnginePhase; currentPomodoroId(): string | null; recordDistraction(pomodoroId: string): Promise<void> },
  distractionSvc: DistractionService,
): void {
  const blockedPageBase = browser.runtime.getURL('src/blocked/index.html');

  browser.webRequest.onBeforeRequest.addListener(
    (details) => {
      const state = engine.currentPhase();
      const allowlist = getAllowlist();
      const decision = shouldBlock(details.url, allowlist, '', state);

      if (!decision.block || !decision.domain) return {};

      const pomodoroId = engine.currentPomodoroId();
      const domain = decision.domain;

      if (!pomodoroId) return {};

      distractionSvc.record({
        pomodoroId,
        type: 'auto_blocked_attempt' as const,
        url: details.url,
        domain,
      })
        .then((distraction) => {
          if (Date.now() - distraction.at < 1000) {
            engine.recordDistraction(pomodoroId).catch(e => console.error('[FocusFox]', e));
          }
        })
        .catch(e => console.error('[FocusFox]', e));

      return {
        redirectUrl: buildBlockedUrl(details.url, domain, blockedPageBase),
      };
    },
    { urls: ['<all_urls>'], types: ['main_frame'] },
    ['blocking'],
  );
}

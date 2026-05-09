import { describe, it, expect, beforeEach } from 'vitest';
import { shouldBlock, isAllowedDomain, buildBlockedUrl } from '@/background/blocker';
import { getAllowlist, setAllowlist } from '@/background/blocker/allowlist-cache';
import type { EnginePhase } from '@/shared/engine-types';

const EXT_ID = 'test-ext-id@example.com';
const BLOCKED_BASE = `moz-extension://${EXT_ID}/blocked/index.html`;

describe('shouldBlock', () => {
  const work: EnginePhase = 'work';
  const idle: EnginePhase = 'idle';
  const shortBreak: EnginePhase = 'short_break';
  const longBreak: EnginePhase = 'long_break';
  const emptyAllowlist: string[] = [];

  it('blocks external HTTP when allowlist is empty', () => {
    const result = shouldBlock('https://twitter.com/status/123', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(true);
    expect(result.domain).toBe('twitter.com');
  });

  it('allows exact domain match', () => {
    const allowlist = ['github.com'];
    const result = shouldBlock('https://github.com/opencode', allowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows subdomain match', () => {
    const allowlist = ['github.com'];
    const result = shouldBlock('https://docs.github.com/reference', allowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('is case-insensitive', () => {
    const allowlist = ['GitHub.com'];
    const result = shouldBlock('https://github.com/repo', allowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows about:blank in work state', () => {
    const result = shouldBlock('about:blank', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows moz-extension: URLs in work state', () => {
    const result = shouldBlock(`moz-extension://${EXT_ID}/popup/index.html`, emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows file: URLs in work state', () => {
    const result = shouldBlock('file:///Users/test/file.html', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows chrome: URLs in work state', () => {
    const result = shouldBlock('chrome://settings', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows data: URLs in work state', () => {
    const result = shouldBlock('data:text/html,hello', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows view-source: URLs in work state', () => {
    const result = shouldBlock('view-source:https://example.com', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('fails open on malformed URL', () => {
    const result = shouldBlock('not-a-valid-url', emptyAllowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('allows any URL in idle state', () => {
    const result = shouldBlock('https://twitter.com', emptyAllowlist, EXT_ID, idle);
    expect(result.block).toBe(false);
  });

  it('allows any URL in short_break state', () => {
    const result = shouldBlock('https://twitter.com', emptyAllowlist, EXT_ID, shortBreak);
    expect(result.block).toBe(false);
  });

  it('allows any URL in long_break state', () => {
    const result = shouldBlock('https://twitter.com', emptyAllowlist, EXT_ID, longBreak);
    expect(result.block).toBe(false);
  });

  it('blocks when domain is not in allowlist', () => {
    const allowlist = ['github.com', 'figma.com'];
    const result = shouldBlock('https://twitter.com/home', allowlist, EXT_ID, work);
    expect(result.block).toBe(true);
    expect(result.domain).toBe('twitter.com');
  });

  it('uses lowercased allowlist for matching', () => {
    const allowlist = ['GITHUB.COM'];
    const result = shouldBlock('https://github.com/repo', allowlist, EXT_ID, work);
    expect(result.block).toBe(false);
  });

  it('returns null domain when not blocking', () => {
    const result = shouldBlock('https://example.com', emptyAllowlist, EXT_ID, idle);
    expect(result.domain).toBeNull();
  });
});

describe('isAllowedDomain', () => {
  it('exact match returns true', () => {
    expect(isAllowedDomain('github.com', ['github.com'])).toBe(true);
  });

  it('subdomain match returns true', () => {
    expect(isAllowedDomain('docs.github.com', ['github.com'])).toBe(true);
  });

  it('deep subdomain match returns true', () => {
    expect(isAllowedDomain('a.b.github.com', ['github.com'])).toBe(true);
  });

  it('no match returns false', () => {
    expect(isAllowedDomain('twitter.com', ['github.com'])).toBe(false);
  });

  it('empty allowlist returns false', () => {
    expect(isAllowedDomain('github.com', [])).toBe(false);
  });

  it('partial domain match does not false-positive', () => {
    expect(isAllowedDomain('mygithub.com', ['github.com'])).toBe(false);
    expect(isAllowedDomain('not-github.com', ['github.com'])).toBe(false);
  });
});

describe('allowlist-cache', () => {
  beforeEach(() => {
    setAllowlist([]);
  });

  it('round-trips get and set', () => {
    setAllowlist(['github.com', 'figma.com']);
    expect(getAllowlist()).toEqual(['github.com', 'figma.com']);
  });

  it('lowercases and trims entries', () => {
    setAllowlist([' GitHub.COM ', 'Docs.Google.com  ']);
    expect(getAllowlist()).toEqual(['github.com', 'docs.google.com']);
  });

  it('filters empty strings', () => {
    setAllowlist(['github.com', '', '  ', 'figma.com']);
    expect(getAllowlist()).toEqual(['github.com', 'figma.com']);
  });
});

describe('buildBlockedUrl', () => {
  it('appends url and domain as query params to base', () => {
    const url = buildBlockedUrl('https://twitter.com/status/123', 'twitter.com', BLOCKED_BASE);
    expect(url).toBe(
      `${BLOCKED_BASE}?url=${encodeURIComponent('https://twitter.com/status/123')}&domain=${encodeURIComponent('twitter.com')}`,
    );
  });

  it('encodes special characters in query params', () => {
    const url = buildBlockedUrl('https://example.com/?a=1&b=2', 'example.com', BLOCKED_BASE);
    expect(url).toContain(encodeURIComponent('https://example.com/?a=1&b=2'));
  });
});

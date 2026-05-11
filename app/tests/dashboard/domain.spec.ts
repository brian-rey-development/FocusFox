import { describe, it, expect } from 'vitest';
import { normalizeDomain, isValidDomain, clampMinutes, msToMinutes, minutesToMs } from '../../src/dashboard/domain';

describe('normalizeDomain', () => {
  it('lowercases input', () => {
    expect(normalizeDomain('GitHub.com')).toBe('github.com');
  });

  it('strips https:// prefix', () => {
    expect(normalizeDomain('https://github.com')).toBe('github.com');
  });

  it('strips http:// prefix', () => {
    expect(normalizeDomain('http://github.com')).toBe('github.com');
  });

  it('strips www. prefix', () => {
    expect(normalizeDomain('www.github.com')).toBe('github.com');
  });

  it('strips path after slash', () => {
    expect(normalizeDomain('github.com/foo/bar')).toBe('github.com');
  });

  it('strips protocol, www, and path combined', () => {
    expect(normalizeDomain('https://www.github.com/repo/issues')).toBe('github.com');
  });
});

describe('isValidDomain', () => {
  it('accepts standard domain', () => {
    expect(isValidDomain('github.com')).toBe(true);
  });

  it('accepts multi-level domain', () => {
    expect(isValidDomain('api.github.com')).toBe(true);
  });

  it('accepts domain with hyphen', () => {
    expect(isValidDomain('my-site.com')).toBe(true);
  });

  it('accepts country TLD', () => {
    expect(isValidDomain('bbc.co.uk')).toBe(true);
  });

  it('rejects single label', () => {
    expect(isValidDomain('localhost')).toBe(false);
  });

  it('rejects IP address', () => {
    expect(isValidDomain('192.168.1.1')).toBe(false);
  });

  it('rejects IP with port', () => {
    expect(isValidDomain('127.0.0.1')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidDomain('')).toBe(false);
  });

  it('rejects string with space', () => {
    expect(isValidDomain('github .com')).toBe(false);
  });

  it('rejects domain with path', () => {
    expect(isValidDomain('github.com/issues')).toBe(false);
  });

  it('accepts subdomain', () => {
    expect(isValidDomain('docs.example.com')).toBe(true);
  });
});

describe('clampMinutes', () => {
  it('returns value within bounds unchanged', () => {
    expect(clampMinutes(30, 1, 120)).toBe(30);
  });

  it('clamps to min', () => {
    expect(clampMinutes(0, 1, 120)).toBe(1);
  });

  it('clamps to max', () => {
    expect(clampMinutes(200, 1, 120)).toBe(120);
  });

  it('returns min at boundary', () => {
    expect(clampMinutes(1, 1, 120)).toBe(1);
  });

  it('returns max at boundary', () => {
    expect(clampMinutes(120, 1, 120)).toBe(120);
  });
});

describe('msToMinutes', () => {
  it('converts 60 seconds to 1 minute', () => {
    expect(msToMinutes(60_000)).toBe(1);
  });

  it('converts 25 minutes of ms', () => {
    expect(msToMinutes(25 * 60_000)).toBe(25);
  });

  it('floors fractional minutes', () => {
    expect(msToMinutes(90_000)).toBe(1);
  });
});

describe('minutesToMs', () => {
  it('converts 1 minute to 60000 ms', () => {
    expect(minutesToMs(1)).toBe(60_000);
  });

  it('converts 25 minutes to ms', () => {
    expect(minutesToMs(25)).toBe(25 * 60_000);
  });
});

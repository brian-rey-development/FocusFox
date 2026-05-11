import { describe, it, expect } from 'vitest';
import { parseHash } from '../../../src/dashboard/hooks/useHashRoute';
import type { Route } from '../../../src/dashboard/hooks/useHashRoute';

describe('parseHash', () => {
  it('empty hash -> hoy tab', () => {
    expect(parseHash('')).toEqual<Route>({ tab: 'hoy', params: {} });
  });

  it('bare # -> hoy tab', () => {
    expect(parseHash('#')).toEqual<Route>({ tab: 'hoy', params: {} });
  });

  it('unknown tab -> hoy tab fallback', () => {
    expect(parseHash('#unknown')).toEqual<Route>({ tab: 'hoy', params: {} });
  });

  it('#hoy -> hoy tab', () => {
    expect(parseHash('#hoy')).toEqual<Route>({ tab: 'hoy', params: {} });
  });

  it('#tareas -> tareas tab no project', () => {
    expect(parseHash('#tareas')).toEqual<Route>({ tab: 'tareas', params: {} });
  });

  it('#tareas/proj-123 -> tareas tab with projectId', () => {
    expect(parseHash('#tareas/proj-123')).toEqual<Route>({
      tab: 'tareas',
      params: { projectId: 'proj-123' },
    });
  });

  it('#stats -> stats tab', () => {
    expect(parseHash('#stats')).toEqual<Route>({ tab: 'stats', params: {} });
  });

  it('#settings -> settings tab', () => {
    expect(parseHash('#settings')).toEqual<Route>({ tab: 'settings', params: {} });
  });

  it('trailing slash is ignored on tareas with project', () => {
    expect(parseHash('#tareas/proj-abc/')).toEqual<Route>({
      tab: 'tareas',
      params: { projectId: 'proj-abc' },
    });
  });

  it('hash without # prefix still works', () => {
    expect(parseHash('stats')).toEqual<Route>({ tab: 'stats', params: {} });
  });
});

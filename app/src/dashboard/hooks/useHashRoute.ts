import { useState, useEffect, useCallback } from 'react';

export type Tab = 'hoy' | 'tareas' | 'stats' | 'settings';

const TABS = new Set<string>(['hoy', 'tareas', 'stats', 'settings']);

export interface Route {
  tab: Tab;
  params: Record<string, string>;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '');
  if (!h) return { tab: 'hoy', params: {} };

  const parts = h.split('/');
  const tab = parts[0] as Tab;
  if (!TABS.has(tab)) return { tab: 'hoy', params: {} };

  const params: Record<string, string> = {};
  if (parts[1]) params.projectId = parts[1];
  return { tab, params };
}

export function useHashRoute(): [Route, (tab: Tab, params?: Record<string, string>) => void] {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));

  useEffect(() => {
    function onHashChange() {
      setRoute(parseHash(window.location.hash));
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((tab: Tab, params?: Record<string, string>) => {
    const hash = params?.projectId ? `#${tab}/${params.projectId}` : `#${tab}`;
    window.location.hash = hash;
  }, []);

  return [route, navigate];
}

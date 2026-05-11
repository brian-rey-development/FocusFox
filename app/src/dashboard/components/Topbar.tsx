import { Settings } from 'lucide-react';
import type { Tab } from '../hooks/useHashRoute';

interface TopbarProps {
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  rightAction?: React.ReactNode;
}

const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'hoy', label: 'Hoy' },
  { id: 'tareas', label: 'Tareas' },
  { id: 'stats', label: 'Estadísticas' },
];

export function Topbar({ tab, onTabChange, rightAction }: TopbarProps) {
  return (
    <header className="topbar">
      <div className="topbar__left">
        <nav className="topbar__tabs" role="tablist" aria-label="Navegación">
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={`topbar__tab${tab === t.id ? ' topbar__tab--active' : ''}`}
              onClick={() => onTabChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      <div className="topbar__right">
        {rightAction}
        <button
          className={`topbar__gear${tab === 'settings' ? ' topbar__gear--active' : ''}`}
          onClick={() => onTabChange('settings')}
          aria-label="Configuración"
        >
          <Settings size={18} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
